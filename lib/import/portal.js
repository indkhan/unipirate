// Apply-method detection from the DAAD "Submit application to" field.
// Returns one of the universities.apply_method enum values, or null when
// undetected (admin must set it before promote).

export function detectApplyMethod(submitTo = '') {
  const t = submitTo.toLowerCase();
  if (!t.trim()) return null;
  if (t.includes('uni-assist') || t.includes('uni assist') || t.includes('uniassist')) {
    return 'uni-assist';
  }
  if (/portal|online application|application form|apply (?:directly|online)|university website|https?:\/\//.test(t)) {
    return 'direct';
  }
  return 'other';
}
