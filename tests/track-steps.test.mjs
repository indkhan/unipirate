import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApplicationSteps } from '../lib/track-steps.js';

test('uses the country playbook and inserts the apply-method step', () => {
  const steps = buildApplicationSteps('India', 'uni-assist');
  assert.ok(steps.length > 0);
  assert.ok(steps.some((s) => s.label === 'Submit application via uni-assist'));
  // sort_order is sequential
  steps.forEach((s, i) => assert.equal(s.sort_order, i));
  steps.forEach((s) => assert.equal(s.done, false));
});

test('direct apply method yields the portal step', () => {
  const steps = buildApplicationSteps('China', 'direct');
  assert.ok(steps.some((s) => s.label === 'Apply directly on the university portal'));
  assert.ok(!steps.some((s) => s.label === 'Submit application via uni-assist'));
});

test('unknown country falls back to a generic checklist', () => {
  const steps = buildApplicationSteps('Atlantis', 'other');
  assert.ok(steps.length >= 2);
  assert.ok(steps.some((s) => /check the university page/i.test(s.label)));
});

test('apply step replaces the generic playbook apply line (no duplicate)', () => {
  const steps = buildApplicationSteps('Pakistan', 'uni-assist');
  const applyish = steps.filter((s) => /apply via|submit application via|apply directly/i.test(s.label));
  assert.equal(applyish.length, 1);
});

test('visa step stays last when present', () => {
  const steps = buildApplicationSteps('India', 'uni-assist');
  const visaIdx = steps.findIndex((s) => /student visa/i.test(s.label));
  if (visaIdx !== -1) assert.equal(visaIdx, steps.length - 1);
});
