-- UP-COURSE-02: reject the key Zod record parsing would silently discard.
-- Existing maps are never rewritten; ordinary keys/vocabulary remain unrestricted.
create or replace function public.valid_offering_applicability(value jsonb)
returns boolean language plpgsql immutable set search_path = public, pg_temp as $$
declare item jsonb; member jsonb;
begin
  if jsonb_typeof(value) is distinct from 'object' or value ? '__proto__' then return false; end if;
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
