import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeQuery,
  toSuggestion,
  toSuggestions,
  suggestAddresses,
  MAX_SUGGESTIONS,
} from './address-suggest';

// A real Geoapify result, trimmed to the fields we read (captured 2026-11-14).
const AMPHITHEATRE = {
  formatted: 'Google Building 41, 1600 Amphitheatre Parkway, Mountain View, CA 94043, United States of America',
  housenumber: '1600',
  street: 'Amphitheatre Parkway',
  city: 'Mountain View',
  state: 'California',
  state_code: 'CA',
  postcode: '94043',
  country: 'United States of America',
  country_code: 'us',
};

/** A copy of `obj` without the given keys (to build results with fields missing). */
function omit(obj: Record<string, unknown>, ...keys: string[]): Record<string, unknown> {
  const copy = { ...obj };
  for (const k of keys) delete copy[k];
  return copy;
}

// --- normalizeQuery ------------------------------------------------------------------------

test('short queries are not looked up', () => {
  assert.equal(normalizeQuery(''), null);
  assert.equal(normalizeQuery('  1 '), null);
  assert.equal(normalizeQuery('12'), null);
});

test('queries are trimmed and whitespace collapsed', () => {
  assert.equal(normalizeQuery('  1600   Amphitheatre  '), '1600 Amphitheatre');
});

test('very long queries are capped rather than rejected', () => {
  assert.equal(normalizeQuery('a'.repeat(500))!.length, 200);
});

// --- toSuggestion ---------------------------------------------------------------------------

test('a full result maps to form fields with a two-letter state', () => {
  assert.deepEqual(toSuggestion(AMPHITHEATRE), {
    label: '1600 Amphitheatre Parkway, Mountain View, CA 94043',
    street: '1600 Amphitheatre Parkway',
    city: 'Mountain View',
    state: 'CA',
    zip: '94043',
    country: 'United States',
  });
});

test('the label is built from our fields, not Geoapify\'s point-of-interest name', () => {
  assert.ok(!toSuggestion(AMPHITHEATRE)!.label.includes('Google Building'));
});

test('a result with no street is not offered', () => {
  assert.equal(toSuggestion(omit(AMPHITHEATRE, 'housenumber', 'street')), null);
});

test('a result with no postcode is not offered', () => {
  assert.equal(toSuggestion(omit(AMPHITHEATRE, 'postcode')), null);
});

test('a result with no city, town or village is not offered', () => {
  assert.equal(toSuggestion(omit(AMPHITHEATRE, 'city')), null);
});

test('a town stands in for a missing city', () => {
  assert.equal(toSuggestion({ ...omit(AMPHITHEATRE, 'city'), town: 'Smallville' })!.city, 'Smallville');
});

test('a street with no house number is still usable', () => {
  assert.equal(toSuggestion(omit(AMPHITHEATRE, 'housenumber'))!.street, 'Amphitheatre Parkway');
});

test('the full state name is used when there is no state code', () => {
  assert.equal(toSuggestion(omit(AMPHITHEATRE, 'state_code'))!.state, 'California');
});

test('garbage input never throws', () => {
  for (const bad of [null, undefined, 42, 'text', [], { street: 7 }]) {
    assert.equal(toSuggestion(bad), null);
  }
});

// --- toSuggestions --------------------------------------------------------------------------

test('points of interest at the same address collapse to one suggestion', () => {
  const googleplex = { ...AMPHITHEATRE, formatted: 'Googleplex, 1600 Amphitheatre Parkway, ...' };
  assert.equal(toSuggestions([AMPHITHEATRE, googleplex]).length, 1);
});

test('unusable results are dropped and the list is capped', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ ...AMPHITHEATRE, housenumber: String(100 + i) }));
  const out = toSuggestions([{ city: 'Nowhere' }, ...many]);
  assert.equal(out.length, MAX_SUGGESTIONS);
  assert.equal(out[0].street, '100 Amphitheatre Parkway');
});

// --- suggestAddresses: every failure path returns [] and never leaks the key -----------------

const KEY = 'TEST-KEY-should-never-leak';
const ok = (body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

test('a short query does not call Geoapify at all', async () => {
  let called = false;
  const out = await suggestAddresses('12', { apiKey: KEY, fetchImpl: async () => { called = true; return new Response('{}'); } });
  assert.deepEqual(out, []);
  assert.equal(called, false);
});

test('without an API key the feature quietly does nothing', async () => {
  let called = false;
  const out = await suggestAddresses('1600 Amphitheatre', { apiKey: '', fetchImpl: async () => { called = true; return new Response('{}'); } });
  assert.deepEqual(out, []);
  assert.equal(called, false);
});

test('a successful lookup returns mapped suggestions, US only', async () => {
  let requested = '';
  const out = await suggestAddresses('1600 Amphitheatre', {
    apiKey: KEY,
    fetchImpl: async (url) => { requested = String(url); return new Response(JSON.stringify({ results: [AMPHITHEATRE] })); },
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].zip, '94043');
  assert.ok(new URL(requested).searchParams.get('filter') === 'countrycode:us');
});

test('a Geoapify error status returns nothing', async () => {
  const out = await suggestAddresses('1600 Amphitheatre', { apiKey: KEY, fetchImpl: async () => new Response('denied', { status: 401 }) });
  assert.deepEqual(out, []);
});

test('a network failure returns nothing instead of throwing', async () => {
  const out = await suggestAddresses('1600 Amphitheatre', { apiKey: KEY, fetchImpl: async () => { throw new TypeError('network down'); } });
  assert.deepEqual(out, []);
});

test('a slow Geoapify is abandoned at the timeout', async () => {
  const hang = (_: string, init?: RequestInit) =>
    new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  const started = Date.now();
  const out = await suggestAddresses('1600 Amphitheatre', { apiKey: KEY, fetchImpl: hang, timeoutMs: 50 });
  assert.deepEqual(out, []);
  assert.ok(Date.now() - started < 1000);
});

test('an unexpected body shape returns nothing', async () => {
  assert.deepEqual(await suggestAddresses('1600 Amphitheatre', { apiKey: KEY, fetchImpl: ok({ features: 'nope' }) }), []);
  assert.deepEqual(await suggestAddresses('1600 Amphitheatre', { apiKey: KEY, fetchImpl: async () => new Response('not json') }), []);
});

test('the API key never appears in a log line', async () => {
  const lines: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
  try {
    await suggestAddresses('1600 Amphitheatre', { apiKey: KEY, fetchImpl: async () => new Response('x', { status: 500 }) });
    await suggestAddresses('1600 Amphitheatre', { apiKey: KEY, fetchImpl: async () => { throw new Error(`boom ${KEY}`); } });
  } finally {
    console.warn = original;
  }
  assert.ok(lines.length >= 2, 'failures should be logged');
  for (const line of lines) assert.ok(!line.includes(KEY), `key leaked: ${line}`);
});
