import { RECOGNITION_RULES } from '@/lib/data';

export { RECOGNITION_RULES };

// Match a profile to a recognition rule.
// Priority: exact (country + qualification) → country wildcard ('Any') → 'Other / Not listed'.
export function matchRecognition(profile, rules = RECOGNITION_RULES) {
  if (!profile?.country || !profile?.qualification) return null;
  let rule = rules.find(
    (r) => r.country === profile.country && r.qualificationType === profile.qualification
  );
  if (rule) return rule;
  rule = rules.find((r) => r.country === profile.country && r.qualificationType === 'Any');
  if (rule) return rule;
  return rules.find((r) => r.country === 'Other / Not listed') || null;
}
