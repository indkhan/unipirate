import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMethod, parseNc } from '../scripts/transforms.mjs';
import { UNIVERSITIES, COURSES } from '../lib/data.js';

test('applyMethod: uni-assist detected', () => {
  assert.equal(applyMethod('uni-assist'), 'uni-assist');
  assert.equal(applyMethod('uni-assist + RWTHonline'), 'uni-assist');
});

test('applyMethod: direct portals', () => {
  assert.equal(applyMethod('TUMonline (direct)'), 'direct');
  assert.equal(applyMethod('C@MPUS (direct)'), 'direct');
});

test('applyMethod: unknown -> other', () => {
  assert.equal(applyMethod('something else'), 'other');
  assert.equal(applyMethod(''), 'other');
});

test('parseNc: numeric NC with year', () => {
  const r = parseNc({ ncFree: false, ncValue: '1.8 (WS 2024/25)' });
  assert.equal(r.nc_value, 1.8);
  assert.equal(r.nc_year, 'WS 2024/25');
  assert.equal(r.nc_value_label, '1.8 (WS 2024/25)');
});

test('parseNc: NC-free course -> null value', () => {
  const r = parseNc({ ncFree: true, ncValue: null });
  assert.equal(r.nc_value, null);
  assert.equal(r.nc_value_label, null);
});

test('parseNc: non-numeric NC keeps label, null value', () => {
  const r = parseNc({ ncFree: false, ncValue: 'Portfolio + interview' });
  assert.equal(r.nc_value, null);
  assert.equal(r.nc_value_label, 'Portfolio + interview');
});

test('every course maps to a real university slug', () => {
  const slugs = new Set(UNIVERSITIES.map((u) => u.id));
  for (const c of COURSES) {
    assert.ok(slugs.has(c.universityId), `course ${c.id} -> unknown uni ${c.universityId}`);
  }
});

test('every course produces a valid apply-free / NC shape', () => {
  for (const c of COURSES) {
    const r = parseNc(c);
    if (!c.ncFree && c.ncValue && /\d/.test(c.ncValue)) {
      assert.equal(typeof r.nc_value, 'number');
    }
  }
});
