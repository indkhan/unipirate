-- UP-COURSE-02: additive catalogue; no existing course/application/task writes.
create type public.course_application_route as enum ('direct', 'uni_assist', 'vpd_then_university', 'unresolved');

-- JSON evidence keeps multiple captures attached to each independently reviewed
-- field. It is not an official-source assertion until a reviewer verifies it.
create function public.valid_offering_facts(facts jsonb, reviewed boolean)
returns boolean language plpgsql immutable set search_path = public, pg_temp
as $$
declare f jsonb; e jsonb; supported boolean; parsed_date date; keys text[] := '{}';
begin
  if jsonb_typeof(facts) is distinct from 'array' then return false; end if;
  for f in select value from jsonb_array_elements(facts) loop
    if jsonb_typeof(f) is distinct from 'object'
      or not (f ?& array['key','kind','status','verbatim','applicability','evidence','route','deadline_kind','date','time','timezone'])
      or (select count(*) from jsonb_object_keys(f)) <> 11
      or jsonb_typeof(f->'key') is distinct from 'string' or btrim(f->>'key') = ''
      or f->>'key' = any(keys)
      or jsonb_typeof(f->'applicability') is distinct from 'string' or btrim(f->>'applicability') = ''
      or coalesce(f->>'kind','') not in ('route','deadline','language','prerequisite','fee','document','description')
      or coalesce(f->>'status','') not in ('pending','verified','rejected','unresolved')
      or jsonb_typeof(f->'evidence') is distinct from 'array'
      or (reviewed and f->>'status' not in ('verified','unresolved')) then return false; end if;
    keys := array_append(keys, f->>'key');
    if f->'verbatim' <> 'null'::jsonb and (jsonb_typeof(f->'verbatim') <> 'string' or btrim(f->>'verbatim') = '') then return false; end if;
    if f->>'kind' = 'route' then
      if coalesce(f->>'route','') not in ('direct','uni_assist','vpd_then_university','unresolved') then return false; end if;
      if f->>'status' = 'verified' and f->>'route' = 'unresolved' then return false; end if;
      if f->>'status' = 'unresolved' and f->>'route' <> 'unresolved' then return false; end if;
    elsif f->'route' <> 'null'::jsonb then return false; end if;
    if f->>'kind' = 'deadline' then
      if coalesce(f->>'deadline_kind','') not in ('application_opening','application_closing','document_supplement','enrolment','vpd_preparation_target') then return false; end if;
    elsif f->'deadline_kind' <> 'null'::jsonb or f->'date' <> 'null'::jsonb or f->'time' <> 'null'::jsonb or f->'timezone' <> 'null'::jsonb then return false; end if;
    if f->'date' <> 'null'::jsonb then
      if f->>'status' <> 'verified' or jsonb_typeof(f->'date') <> 'string' or f->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
      parsed_date := (f->>'date')::date;
      if to_char(parsed_date, 'YYYY-MM-DD') <> f->>'date' then return false; end if;
    end if;
    if f->'time' <> 'null'::jsonb and (f->>'status' <> 'verified' or f->'date' = 'null'::jsonb or jsonb_typeof(f->'time') <> 'string' or f->>'time' !~ '^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$') then return false; end if;
    if f->'timezone' <> 'null'::jsonb and (f->>'status' <> 'verified' or f->'time' = 'null'::jsonb or jsonb_typeof(f->'timezone') <> 'string' or btrim(f->>'timezone') = '') then return false; end if;
    supported := false;
    for e in select value from jsonb_array_elements(f->'evidence') loop
      if jsonb_typeof(e) is distinct from 'object'
        or not (e ?& array['source_url','source_quote','retrieved_at','last_verified_at','verified_by','source_hash'])
        or (select count(*) from jsonb_object_keys(e)) <> 6
        or jsonb_typeof(e->'source_url') is distinct from 'string' or e->>'source_url' !~ '^https?://[^[:space:]/]+'
        or jsonb_typeof(e->'source_quote') is distinct from 'string' or btrim(e->>'source_quote') = ''
        or jsonb_typeof(e->'retrieved_at') is distinct from 'string'
        or e->>'retrieved_at' !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$'
        or ((e->'last_verified_at' = 'null'::jsonb) <> (e->'verified_by' = 'null'::jsonb)) then return false; end if;
      perform (e->>'retrieved_at')::timestamptz;
      if e->'source_hash' <> 'null'::jsonb and (jsonb_typeof(e->'source_hash') <> 'string' or btrim(e->>'source_hash') = '') then return false; end if;
      if e->'last_verified_at' <> 'null'::jsonb then
        if jsonb_typeof(e->'last_verified_at') <> 'string' or e->>'last_verified_at' !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$'
          or jsonb_typeof(e->'verified_by') <> 'string' then return false; end if;
        perform (e->>'verified_by')::uuid;
        if (e->>'last_verified_at')::timestamptz < (e->>'retrieved_at')::timestamptz then return false; end if;
        supported := supported or (f->>'verbatim' is not null and strpos(e->>'source_quote', f->>'verbatim') > 0);
      end if;
    end loop;
    if f->>'status' = 'verified' and not supported then return false; end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;

create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  legacy_course_id uuid unique references public.courses(id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  university_name text not null check (btrim(university_name) <> ''),
  degree text check (btrim(degree) <> ''),
  source_url text not null check (source_url ~ '^https?://[^[:space:]/]+'),
  created_at timestamptz not null default now()
);
create table public.course_offerings (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete restrict,
  intake_term text not null check (intake_term in ('summer','winter')),
  intake_year integer not null check (intake_year between 1 and 9999),
  applicant_group text not null check (btrim(applicant_group) <> ''),
  applicability jsonb not null check (jsonb_typeof(applicability) = 'object'),
  created_at timestamptz not null default now(),
  unique (programme_id, intake_term, intake_year, applicant_group, applicability)
);
create table public.course_offering_versions (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings(id) on delete restrict,
  version integer not null check (version > 0),
  review_status text not null default 'pending' check (review_status in ('pending','verified','rejected')),
  reviewed_at timestamptz,
  -- Historical reviewer identities survive account removal; no cascading FK.
  reviewed_by uuid,
  facts jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (offering_id, version),
  check (case when review_status = 'pending' then reviewed_at is null and reviewed_by is null else reviewed_at is not null and reviewed_by is not null end),
  check (public.valid_offering_facts(facts, review_status = 'verified'))
);
create index course_offering_versions_reviewed_idx on public.course_offering_versions(offering_id, version desc) where review_status = 'verified';

-- Immutable scope and snapshots: review/correction creates a new version,
-- never overwrites a reviewed version or guesses a legacy intake.
create function public.preserve_course_catalog_history()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin raise exception 'course catalogue history is append-only'; end;
$$;
create trigger preserve_history before delete on public.programmes for each row execute function public.preserve_course_catalog_history();
create function public.preserve_programme_identity()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.id is distinct from old.id or new.legacy_course_id is distinct from old.legacy_course_id
    or new.created_at is distinct from old.created_at then
    raise exception 'programme identity is immutable';
  end if;
  return new;
end;
$$;
create trigger preserve_identity before update on public.programmes for each row execute function public.preserve_programme_identity();

-- Reuse the existing admin audit stream. Preserve before/after label corrections,
-- without changing or republishing any offering evidence snapshot.
alter table public.admin_audit_events
  add column programme_correction jsonb,
  drop constraint admin_audit_events_table_name_check,
  add constraint admin_audit_events_table_name_check check (
    table_name in ('rules', 'courses', 'course_task_definitions', 'course_task_source_reviews', 'programmes')
  );
create function public.audit_programme_correction()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.admin_audit_events(actor_user_id, table_name, row_id, action, programme_correction)
  values (auth.uid(), 'programmes', new.id, 'update', jsonb_build_object(
    'old', to_jsonb(old) - array['id','legacy_course_id','created_at'],
    'new', to_jsonb(new) - array['id','legacy_course_id','created_at']
  ));
  return new;
end;
$$;
revoke all on function public.audit_programme_correction() from public;
create trigger audit_correction after update on public.programmes for each row
  when (old.name is distinct from new.name or old.university_name is distinct from new.university_name
    or old.degree is distinct from new.degree or old.source_url is distinct from new.source_url)
  execute function public.audit_programme_correction();
create trigger preserve_history before update or delete on public.course_offerings for each row execute function public.preserve_course_catalog_history();
create trigger preserve_history before update or delete on public.course_offering_versions for each row execute function public.preserve_course_catalog_history();

alter table public.programmes enable row level security;
alter table public.course_offerings enable row level security;
alter table public.course_offering_versions enable row level security;
create policy "admin catalogue read" on public.programmes for select using ((select public.is_admin()));
create policy "admin catalogue insert" on public.programmes for insert to authenticated with check ((select public.is_admin()));
create policy "admin catalogue correct" on public.programmes for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin offering read" on public.course_offerings for select using ((select public.is_admin()));
create policy "admin offering insert" on public.course_offerings for insert to authenticated with check ((select public.is_admin()));
create policy "admin version read" on public.course_offering_versions for select using ((select public.is_admin()));
create policy "admin version insert" on public.course_offering_versions for insert to authenticated with check ((select public.is_admin()) and (review_status = 'pending' or reviewed_by = (select auth.uid())));
create policy "public reviewed versions" on public.course_offering_versions for select using (review_status = 'verified');
create policy "public reviewed offerings" on public.course_offerings for select using (exists (select 1 from public.course_offering_versions v where v.offering_id = course_offerings.id and v.review_status = 'verified'));
create policy "public reviewed programmes" on public.programmes for select using (exists (select 1 from public.course_offerings o where o.programme_id = programmes.id));
revoke all on public.programmes, public.course_offerings, public.course_offering_versions from anon, authenticated;
grant select on public.programmes, public.course_offerings, public.course_offering_versions to anon, authenticated;
grant insert on public.programmes, public.course_offerings, public.course_offering_versions to authenticated;
grant update (name, university_name, degree, source_url) on public.programmes to authenticated;
grant all on public.programmes, public.course_offerings, public.course_offering_versions to service_role;
-- Applicability remains explicit data; no implicit universal scope or coercion.
create function public.valid_offering_applicability(value jsonb)
returns boolean language plpgsql immutable set search_path = public, pg_temp as $$
declare item jsonb; member jsonb;
begin
  if jsonb_typeof(value) is distinct from 'object' then return false; end if;
  for item in select v from jsonb_each(value) as entry(k,v) loop
    if jsonb_typeof(item) = 'string' then
      if btrim(item #>> '{}') = '' then return false; end if;
    elsif jsonb_typeof(item) = 'array' then
      for member in select v from jsonb_array_elements(item) as entry(v) loop
        if jsonb_typeof(member) is distinct from 'string' or btrim(member #>> '{}') = '' then return false; end if;
      end loop;
    elsif jsonb_typeof(item) is distinct from 'boolean' then return false;
    end if;
  end loop;
  return true;
end;
$$;
alter table public.course_offerings add constraint course_offering_applicability_contract check (public.valid_offering_applicability(applicability));
