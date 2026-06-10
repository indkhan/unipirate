// Pure transforms used by the seed script — extracted so they can be unit-tested
// without importing the DB-connecting seed entrypoint.

// Map a university's free-text portal label to an apply_method enum.
export function applyMethod(portalType = '') {
  if (/uni-assist/i.test(portalType)) return 'uni-assist';
  if (/direct/i.test(portalType)) return 'direct';
  return 'other';
}

// Parse a course's free-text NC value into { nc_value, nc_value_label, nc_year }.
// Examples: '1.8 (WS 2024/25)' -> 1.8 + year; 'Portfolio + interview' -> null value.
export function parseNc(course) {
  if (course.ncFree) return { nc_value: null, nc_value_label: null, nc_year: null };
  const raw = course.ncValue;
  if (!raw) return { nc_value: null, nc_value_label: null, nc_year: null };
  const num = String(raw).match(/(\d+\.?\d*)/);
  const year = String(raw).match(/\(([^)]+)\)/);
  return {
    nc_value: num ? Number(num[1]) : null,
    nc_value_label: raw,
    nc_year: year ? year[1] : null,
  };
}
