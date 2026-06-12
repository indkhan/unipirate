-- Multiple language certificates per user, each with its own status.
-- Shape: [{ cert: 'IELTS', score: '7.0', status: 'planning'|'waiting'|'done' }].
-- The legacy language_cert / language_score columns are kept (mirrored to the
-- primary cert) so existing reads keep working.
alter table public.profiles
  add column if not exists language_certs jsonb not null default '[]';
