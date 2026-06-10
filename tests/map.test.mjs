import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapUniversity, mapCourse } from '../lib/repo/map.js';

test('mapUniversity: slug becomes id, labels mapped', () => {
  const u = mapUniversity({
    id: 'uuid-1',
    slug: 'tum',
    name: 'Technical University of Munich',
    short: 'TUM',
    city: 'Munich',
    state: 'Bavaria',
    apply_method: 'direct',
    portal_label: 'TUMonline (direct)',
    general_deadlines: 'Winter: 15 Jul',
    semester_contribution: '€ 85 / semester',
    blurb: 'b',
  });
  assert.equal(u.id, 'tum');
  assert.equal(u.portalType, 'TUMonline (direct)');
  assert.equal(u.applyMethod, 'direct');
  assert.equal(u.generalDeadlines, 'Winter: 15 Jul');
});

test('mapUniversity: portalType falls back to apply_method', () => {
  const u = mapUniversity({ slug: 'x', apply_method: 'uni-assist', portal_label: null });
  assert.equal(u.portalType, 'uni-assist');
});

test('mapCourse: resolves university FK back to slug', () => {
  const c = mapCourse(
    {
      id: 'cuuid',
      slug: 'tum-cs',
      university_id: 'uuid-1',
      name: 'Informatics',
      degree: 'B.Sc.',
      semester: 'Winter only',
      language: 'German',
      nc_free: false,
      nc_value: 1.8,
      nc_value_label: '1.8 (WS 2024/25)',
      nc_year: 'WS 2024/25',
      keywords: ['cs'],
    },
    { 'uuid-1': 'tum' }
  );
  assert.equal(c.id, 'tum-cs');
  assert.equal(c.universityId, 'tum');
  assert.equal(c.ncValue, '1.8 (WS 2024/25)'); // UI shows the label
  assert.equal(c.ncValueNum, 1.8);
  assert.deepEqual(c.keywords, ['cs']);
});

test('mapCourse: NC-free course has null ncValue', () => {
  const c = mapCourse({ slug: 's', university_id: 'u', nc_free: true, nc_value: null, nc_value_label: null });
  assert.equal(c.ncFree, true);
  assert.equal(c.ncValue, null);
});

test('mapCourse: unmapped FK falls through to raw id', () => {
  const c = mapCourse({ slug: 's', university_id: 'unknown-uuid' }, {});
  assert.equal(c.universityId, 'unknown-uuid');
});
