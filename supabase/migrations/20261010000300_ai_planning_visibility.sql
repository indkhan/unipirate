-- Context fingerprints called by AFTER triggers must see the statement's new rows.
-- STABLE snapshots can coalesce a changed definition against its pre-change event.
alter function public.planning_context_fingerprint(uuid,uuid) volatile;
alter function public.get_planning_context_fingerprint(uuid) volatile;
