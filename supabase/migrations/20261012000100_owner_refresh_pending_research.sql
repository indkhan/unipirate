-- Let importers refresh research facts on their own pending courses after the
-- save-first import (#58) completes background research. Approved courses stay
-- admin-only; review_status and ownership columns are not widened by this
-- policy (both USING and WITH CHECK require the row to stay an own pending
-- import, so promotion or reassignment through this policy is impossible).

create policy "owner refresh own pending research"
on public.courses for update
using (imported_by = auth.uid() and review_status = 'pending')
with check (imported_by = auth.uid() and review_status = 'pending');
