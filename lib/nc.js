// Deterministic eligibility math. No AI, no side effects — pure functions so the
// verdicts are reproducible and testable. Phrasing lives in templates here.

// --- Grade conversion: Modified Bavarian Formula (official KMK / uni-assist) ---
// germanGrade = 1 + 3 * (Nmax - Nd) / (Nmax - Nmin)
// Result: 1.0 (best) .. 4.0 (min pass), rounded to one decimal.
// The German scale itself is the identity case (n_max=1.0, n_min=4.0).

export function roundGrade(x) {
  return Math.round(x * 10) / 10;
}

// Find the conversion row for a qualification+scale. Falls back to a generic
// row keyed by qualification_type '*' for the same scale.
export function findConversion(qualificationType, gradingScale, rows = []) {
  return (
    rows.find(
      (r) => r.qualification_type === qualificationType && r.grading_scale === gradingScale
    ) ||
    rows.find((r) => r.qualification_type === '*' && r.grading_scale === gradingScale) ||
    null
  );
}

// Convert a raw foreign grade to the German 1.0–4.0 scale.
// Returns null when the grade is non-numeric or no conversion row exists.
export function toGermanGrade(rawGrade, { qualificationType, gradingScale }, rows = []) {
  const nd = Number(rawGrade);
  if (rawGrade === '' || rawGrade == null || Number.isNaN(nd)) return null;

  const conv = findConversion(qualificationType, gradingScale, rows);
  if (!conv) return null;

  const { n_max, n_min } = conv;
  if (n_max === n_min) return null; // guard div-by-zero
  const german = 1 + 3 * (n_max - nd) / (n_max - n_min);

  // Clamp to the meaningful admission range.
  return roundGrade(Math.min(4.0, Math.max(1.0, german)));
}

// --- NC verdict (per course) ---
// German grades: lower is better. nc_value = last year's closing grade.
// margin = nc_value - userGrade  → positive means the student beats the cutoff.
const STRONG_MARGIN = 0.3;

export function ncVerdict({ course, germanGrade }) {
  if (course.nc_free) {
    return {
      tier: 'open',
      label: 'Open admission',
      detail: 'This program is NC-free — recognition is all you need to apply.',
    };
  }

  if (course.nc_value == null) {
    return {
      tier: 'unknown',
      label: 'NC unconfirmed',
      detail: 'We don’t have a confirmed NC for this program — check the university page.',
    };
  }

  if (germanGrade == null) {
    return {
      tier: 'no_conversion',
      label: 'Matching not available',
      detail: 'Grade matching isn’t available for your grading system yet.',
    };
  }

  const margin = roundGrade(course.nc_value - germanGrade);
  const base = `Your converted grade is ${germanGrade.toFixed(1)}; last year’s NC was ${course.nc_value.toFixed(1)}` +
    (course.nc_year ? ` (${course.nc_year})` : '') + '. NC is last year’s closing grade, not a fixed bar.';

  if (margin >= STRONG_MARGIN) {
    return { tier: 'strong', label: 'Strong chance', detail: base, margin };
  }
  if (margin <= -STRONG_MARGIN) {
    return {
      tier: 'unlikely',
      label: 'Unlikely',
      detail: base + ' Some seats go via other quotas, and the NC can move.',
      margin,
    };
  }
  return { tier: 'borderline', label: 'Borderline', detail: base, margin };
}

// --- Recognition threshold gating ---
// Some country verdicts depend on grade (India/China ≥70%). When the rule has a
// raw-percent threshold, pick the base or the *_if_below variant.
export function resolveRecognition(rule, profile) {
  if (!rule) return null;
  const hasThreshold = rule.grade_threshold != null && rule.status_if_below != null;
  if (!hasThreshold) return normalizeRule(rule, false);

  // raw_percent: compare the numeric grade directly (assumes a percentage input).
  const grade = Number(profile?.grade);
  const isPercent = (profile?.grading_scale || profile?.gradingScale || '').toLowerCase().includes('percent');
  const meets =
    rule.grade_threshold_kind === 'raw_percent' && isPercent && !Number.isNaN(grade)
      ? grade >= rule.grade_threshold
      : true; // can't evaluate threshold → don't downgrade

  return normalizeRule(rule, !meets);
}

function normalizeRule(rule, below) {
  if (!below) {
    return {
      status: rule.status,
      headline: rule.headline,
      explanation: rule.explanation,
      next_steps: rule.next_steps,
      action_links: rule.action_links,
      anabin_url: rule.anabin_url,
      needs_aps: rule.needs_aps,
      below: false,
    };
  }
  return {
    status: rule.status_if_below,
    headline: rule.headline_if_below ?? rule.headline,
    explanation: rule.explanation_if_below ?? rule.explanation,
    next_steps: rule.next_steps_if_below ?? rule.next_steps,
    action_links: rule.action_links,
    anabin_url: rule.anabin_url,
    needs_aps: rule.needs_aps,
    below: true,
  };
}
