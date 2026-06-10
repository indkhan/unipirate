import { COUNTRY_PLAYBOOKS } from './seed-data.js';

// Build the per-application checklist from the applicant's country playbook
// plus a step reflecting the university's application method. Pure + testable.
export function buildApplicationSteps(country, applyMethod, playbooks = COUNTRY_PLAYBOOKS) {
  const pb = playbooks.find((p) => p.country === country);
  const base = pb
    ? [...pb.steps]
    : ['Verify your qualification on anabin', 'Prepare language proof', 'Apply for student visa'];

  const applyLabel =
    applyMethod === 'uni-assist'
      ? 'Submit application via uni-assist'
      : applyMethod === 'direct'
      ? 'Apply directly on the university portal'
      : 'Submit application (check the university page for the method)';

  // Replace a generic "Apply via ..." playbook step with the method-specific
  // one; otherwise insert it before the visa step (or at the end).
  const steps = [];
  let inserted = false;
  for (const label of base) {
    if (/^apply via/i.test(label)) {
      steps.push(applyLabel);
      inserted = true;
    } else if (/student visa/i.test(label) && !inserted) {
      steps.push(applyLabel);
      inserted = true;
      steps.push(label);
    } else {
      steps.push(label);
    }
  }
  if (!inserted) steps.push(applyLabel);

  return steps.map((label, i) => ({ label, sort_order: i, done: false }));
}
