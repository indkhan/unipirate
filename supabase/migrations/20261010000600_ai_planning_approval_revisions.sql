-- Approval requires the exact positive shown revision and still-current sources/date.
create or replace function public.approve_task_proposals(p_selection jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare selected jsonb; proposal public.task_proposals%rowtype; task public.tasks%rowtype; result jsonb:='[]'; accepted_hash text;
 next_title text; next_description text; next_date date; edits jsonb; fields text[]; scoped_course uuid;
begin
 if auth.uid() is null then raise insufficient_privilege using message='Authentication required';end if;
 if jsonb_typeof(p_selection) is distinct from 'array' or jsonb_array_length(p_selection) not between 1 and 100
   or (select count(distinct e->>'id') from jsonb_array_elements(p_selection) e)<>jsonb_array_length(p_selection) then raise check_violation using message='Select exact shown IDs and revisions';end if;
 if exists(select 1 from jsonb_array_elements(p_selection) e
   where jsonb_typeof(e) is distinct from 'object' or not(e ?& array['id','revision'])
     or jsonb_typeof(e->'id') is distinct from 'string' or jsonb_typeof(e->'revision') is distinct from 'number'
     or coalesce(e->>'revision','') !~ '^[1-9][0-9]*$' or length(e->>'revision')>16
 ) then raise check_violation using message='Positive integer proposal revision required';end if;
 -- Shared readers remain concurrent. Source writers use exclusive gates before commit,
 -- preventing template/rule insert phantoms without locking whole tables.
 perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('planning-rules',0));
 for scoped_course in select distinct course_id from public.task_proposals where user_id=auth.uid()
   and id in(select (e->>'id')::uuid from jsonb_array_elements(p_selection) e) and course_id is not null order by course_id
 loop
   perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('planning-course:'||scoped_course::text,0));
 end loop;
 -- Lock in UUID order so overlapping selected batches cannot deadlock. One stale item rolls back all.
 perform 1 from public.task_proposals where user_id=auth.uid() and id in(select (e->>'id')::uuid from jsonb_array_elements(p_selection) e) order by id for update;
 if (select count(*) from public.task_proposals where user_id=auth.uid() and id in(select (e->>'id')::uuid from jsonb_array_elements(p_selection) e))<>jsonb_array_length(p_selection) then raise insufficient_privilege using message='Owned proposals required';end if;
 for selected in select value from jsonb_array_elements(p_selection) loop
   if jsonb_typeof(selected) is distinct from 'object' or not(selected ?& array['id','revision']) or (select count(*) from jsonb_object_keys(selected))<>(case when selected ? 'edit' then 3 else 2 end) then raise check_violation using message='Invalid proposal selection';end if;
   select * into proposal from public.task_proposals where id=(selected->>'id')::uuid and user_id=auth.uid();
   accepted_hash:=encode(sha256(convert_to(selected::text,'UTF8')),'hex');
   if proposal.status='approved' and proposal.approved_revision=(selected->>'revision')::bigint and proposal.approval_fingerprint=accepted_hash then
     select * into task from public.tasks where id=proposal.approved_task_id and user_id=auth.uid();
     result:=result||jsonb_build_array(jsonb_build_object('status',case when found then 'already_exists' else 'deleted' end,'proposal_id',proposal.id,'task_id',proposal.approved_task_id));continue;
   end if;
   if proposal.status<>'pending' or proposal.revision is distinct from (selected->>'revision')::bigint then raise check_violation using message='Proposal revision needs refreshed review';end if;
   perform 1 from public.profiles where user_id=auth.uid() for share;
   if proposal.application_id is not null then perform 1 from public.applications where id=proposal.application_id and user_id=auth.uid() for share;end if;
   if proposal.course_id is not null then perform 1 from public.courses where id=proposal.course_id for share;end if;
   -- The protected producer takes FOR UPDATE on this exact immutable offering.
   if proposal.offering_id is not null then perform 1 from public.course_offerings where id=proposal.offering_id for share;end if;
   if proposal.stage='verified' and proposal.due_date is not null and proposal.due_date<(pg_catalog.clock_timestamp() at time zone 'Europe/Berlin')::date then raise check_violation using message='Official deadline passed; refresh reviewed instructions';end if;
   if proposal.input_fingerprint is distinct from public.planning_context_fingerprint(auth.uid(),proposal.application_id) then raise check_violation using message='stale_context';end if;
   if proposal.stage='verified' and not exists(select 1 from public.course_offering_versions v join public.applications a on a.offering_id=v.offering_id where a.id=proposal.application_id and a.user_id=auth.uid() and a.status='planning' and v.id=proposal.source_version_id and v.review_status='verified' and v.version=(select max(version) from public.course_offering_versions where offering_id=a.offering_id and review_status='verified')) then raise check_violation using message='Verified applicability needs refreshed review';end if;
   next_title:=proposal.title;next_description:=proposal.description;next_date:=proposal.due_date;fields:=proposal.change_fields;
   edits:=selected->'edit';
   if selected ? 'edit' then
     if jsonb_typeof(edits) is distinct from 'object' or not(edits ?& array['title','description','due_date']) or (select count(*) from jsonb_object_keys(edits))<>3
       or jsonb_typeof(edits->'title') is distinct from 'string' or jsonb_typeof(edits->'description') not in ('string','null') or jsonb_typeof(edits->'due_date') not in ('string','null')
       or length(btrim(edits->>'title')) not between 1 and 200 or length(edits->>'description')>2000 or (edits->>'due_date' is not null and edits->>'due_date' !~ '^\d{4}-\d{2}-\d{2}$') then raise check_violation using message='Invalid personal task edit';end if;
     next_title:=edits->>'title';next_description:=edits->>'description';next_date:=(edits->>'due_date')::date;
     -- Full edit form is a snapshot, not permission to overwrite unrelated personal changes.
     if next_title is distinct from proposal.title then fields:=array_append(fields,'title');end if;
     if next_description is distinct from proposal.description then fields:=array_append(fields,'description');end if;
     if next_date is distinct from proposal.due_date then fields:=array_append(fields,'due_date');end if;
   end if;
   if proposal.approved_task_id is null then
     insert into public.tasks(user_id,application_id,title,description,due_date,task_key,source_url,verbatim_due,has_personal_edits)
     values(auth.uid(),proposal.application_id,next_title,next_description,next_date,null,proposal.evidence->0->>'source_url',case when edits is null then proposal.verbatim_due else null end,true) returning * into task;
   else
     select * into task from public.tasks where id=proposal.approved_task_id and user_id=auth.uid() and application_id is not distinct from proposal.application_id for update;
     if not found or task.planning_revision is distinct from proposal.base_task_revision then raise check_violation using message='Task changed since proposal; refresh review';end if;
     update public.tasks set title=case when 'title'=any(fields) then next_title else title end,
       description=case when 'description'=any(fields) then next_description else description end,
       due_date=case when 'due_date'=any(fields) then next_date else due_date end,
       verbatim_due=case when 'due_date'=any(fields) then case when edits is null then proposal.verbatim_due else null end else verbatim_due end,
       has_personal_edits=true where id=task.id returning * into task;
   end if;
   update public.task_proposals set status='approved',approved_task_id=task.id,approved_revision=proposal.revision,approval_fingerprint=accepted_hash,
     base_task_revision=task.planning_revision,before_task=null,updated_at=now() where id=proposal.id;
   result:=result||jsonb_build_array(jsonb_build_object('status',case when proposal.approved_task_id is null then 'created' else 'updated' end,'proposal_id',proposal.id,'task_id',task.id,'title',task.title,'due_date',task.due_date,'application_id',task.application_id));
 end loop;
 return result;
end $$;
create or replace function public.dismiss_task_proposal(p_id uuid,p_revision bigint)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege using message='Authentication required';end if;
 if p_revision is null or p_revision<1 then raise check_violation using message='Positive proposal revision required';end if;
 update public.task_proposals set status='dismissed',updated_at=now() where id=p_id and user_id=auth.uid() and revision=p_revision and status in ('pending','dismissed','needs_recheck');
 return found;
end $$;

create function public.serialize_planning_source_write()
returns trigger language plpgsql security definer set search_path='' as $$
declare course uuid;
begin
 if tg_table_name='rule_versions' then
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('planning-rules',0));
 else
   course:=case when tg_op='DELETE' then old.course_id else new.course_id end;
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('planning-course:'||course::text,0));
 end if;
 return null;
end $$;
revoke all on function public.serialize_planning_source_write() from public,anon,authenticated;
create trigger serialize_planning_rules after insert on public.rule_versions for each row execute function public.serialize_planning_source_write();
create trigger serialize_planning_templates after insert or update or delete on public.course_task_definitions for each row execute function public.serialize_planning_source_write();
