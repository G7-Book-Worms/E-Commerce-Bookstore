import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityDateRange, activityFilterParams, isValidDay, parseActivityFilters, startOfStoreDay } from './activity-filters';

test('no parameters means everything, newest first, page 1', () => {
  assert.deepEqual(parseActivityFilters({}), {
    category: undefined, actor: undefined, q: undefined, from: undefined, to: undefined, sort: 'newest', page: 1,
  });
});

test('valid values are kept', () => {
  const f = parseActivityFilters({ category: 'security', actor: 'admin', q: '  order.placed ', from: '2026-11-01', to: '2026-11-14', sort: 'oldest', page: '3' });
  assert.deepEqual(f, { category: 'security', actor: 'admin', q: 'order.placed', from: '2026-11-01', to: '2026-11-14', sort: 'oldest', page: 3 });
});

test('anything off the whitelist is dropped', () => {
  const f = parseActivityFilters({ category: "security' OR 1=1 --", actor: 'root', sort: 'random', page: '-4', from: '2026-02-30', to: 'yesterday' });
  assert.equal(f.category, undefined);
  assert.equal(f.actor, undefined);
  assert.equal(f.sort, 'newest');
  assert.equal(f.page, 1);
  assert.equal(f.from, undefined);
  assert.equal(f.to, undefined);
  assert.equal(parseActivityFilters({ page: '2.5' }).page, 1);
  assert.equal(parseActivityFilters({ page: '99999999' }).page, 10000);
  assert.equal(parseActivityFilters({ category: '__proto__' }).category, undefined);
});

test('repeated parameters use the first value', () => {
  assert.equal(parseActivityFilters({ category: ['orders', 'security'] }).category, 'orders');
});

test('search text is trimmed and capped, blank search is ignored', () => {
  assert.equal(parseActivityFilters({ q: '   ' }).q, undefined);
  assert.equal(parseActivityFilters({ q: 'x'.repeat(500) }).q?.length, 100);
});

test('a backwards date range is swapped', () => {
  const f = parseActivityFilters({ from: '2026-11-14', to: '2026-11-01' });
  assert.equal(f.from, '2026-11-01');
  assert.equal(f.to, '2026-11-14');
});

test('day validation', () => {
  assert.equal(isValidDay('2028-02-29'), true);
  assert.equal(isValidDay('2026-02-29'), false);
  assert.equal(isValidDay('2026-13-01'), false);
  assert.equal(isValidDay('1900-01-01'), false);
  assert.equal(isValidDay('2026-1-1'), false);
});

test('days start at midnight store time (Chicago), across daylight saving', () => {
  assert.equal(startOfStoreDay('2026-11-14').toISOString(), '2026-11-14T06:00:00.000Z'); // CST
  assert.equal(startOfStoreDay('2026-07-04').toISOString(), '2026-07-04T05:00:00.000Z'); // CDT
  assert.equal(startOfStoreDay('2026-11-01').toISOString(), '2026-11-01T05:00:00.000Z'); // DST ends at 2am that day
  assert.equal(startOfStoreDay('2026-03-08').toISOString(), '2026-03-08T06:00:00.000Z'); // DST starts at 2am that day
});

test('the "to" day is included in full', () => {
  const r = activityDateRange({ from: '2026-11-01', to: '2026-11-14' });
  assert.equal(r.start?.toISOString(), '2026-11-01T05:00:00.000Z');
  assert.equal(r.end?.toISOString(), '2026-11-15T06:00:00.000Z');
  assert.deepEqual(activityDateRange({}), { start: undefined, end: undefined });
  assert.equal(activityDateRange({ to: '2026-12-31' }).end?.toISOString(), '2027-01-01T06:00:00.000Z');
});

test('query-string values leave out defaults', () => {
  assert.deepEqual(activityFilterParams(parseActivityFilters({ category: 'orders', page: '2' })), {
    category: 'orders', actor: undefined, q: undefined, from: undefined, to: undefined, sort: undefined,
  });
  assert.equal(activityFilterParams(parseActivityFilters({ sort: 'oldest' })).sort, 'oldest');
});
