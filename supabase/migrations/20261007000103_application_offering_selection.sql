-- UP-PROC-01: nullable owner-reported offering selection on existing identities.
-- No backfill, catalogue publication, application status or task mutation.
alter table public.applications
  add column offering_id uuid references public.course_offerings(id) on delete restrict,
  add column offering_applicant_context jsonb;

create function public.valid_application_offering_context(value jsonb)
returns boolean language plpgsql immutable set search_path = public, pg_temp as $$
begin
  if jsonb_typeof(value) is distinct from 'object'
    or not (value ?& array['applicant_group','confirmed'])
    or (select count(*) from jsonb_object_keys(value)) <> 2
    or jsonb_typeof(value->'applicant_group') is distinct from 'string'
    or not public.valid_course_capture_text(value->>'applicant_group')
    or value->'confirmed' is distinct from 'true'::jsonb then return false; end if;
  return true;
end;
$$;
alter table public.applications add constraint application_offering_context_contract check (
  (offering_id is null and offering_applicant_context is null)
  or (offering_id is not null and offering_applicant_context is not null
    and public.valid_application_offering_context(offering_applicant_context))
);

-- Invoker scope deliberately retains catalogue RLS. An admin may select for
-- their own application, but pending/rejected research cannot authorize a route.
create function public.validate_application_offering_selection()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.offering_id is not null and not exists (
    select 1 from public.course_offerings o
    join public.programmes p on p.id = o.programme_id
    where o.id = new.offering_id and p.legacy_course_id = new.course_id
      and o.applicant_group = new.offering_applicant_context->>'applicant_group'
      and exists (select 1 from public.course_offering_versions v where v.offering_id = o.id and v.review_status = 'verified')
  ) then
    raise exception 'Offering selection must match this application course and reported applicant group';
  end if;
  return new;
end;
$$;
create trigger validate_offering_selection before insert or update of offering_id, offering_applicant_context, course_id on public.applications
  for each row execute function public.validate_application_offering_selection();
-- Existing owner CRUD/admin-read policies stay unchanged. No elevated writer or new RPC.
