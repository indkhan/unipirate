-- Course import: extracted university name (universities FK stays for curated links)
-- and per-field-group extraction method, e.g.
-- {"core":"library","deadlines":"library","requirements":"ai","tuition":"library"}.
alter table public.courses
  add column university_name text,
  add column field_extraction jsonb;
