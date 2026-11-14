// Address autocomplete (Session 5) backed by Geoapify.
//
// The browser never talks to Geoapify and never sees the API key: forms POST what the shopper has
// typed to /api/address/suggest, which calls Geoapify from the server and returns only the five
// fields an address form needs. Autocomplete is an enhancement, never a requirement - every
// failure path (no key, timeout, Geoapify error, nothing found) returns an empty list so the form
// simply behaves as it did before, and manual entry always works.
import { z } from 'zod';

export interface AddressSuggestion {
  /** What the dropdown shows, built from our own fields so it matches what will be filled in. */
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export const MIN_QUERY_LENGTH = 3;
export const MAX_QUERY_LENGTH = 200;
export const MAX_SUGGESTIONS = 5;
const GEOAPIFY_TIMEOUT_MS = 4000;
const GEOAPIFY_URL = 'https://api.geoapify.com/v1/geocode/autocomplete';

export const addressSuggestSchema = z.object({
  q: z.string().max(MAX_QUERY_LENGTH, 'That is too long to look up'),
});

/**
 * Trims and collapses whitespace. Returns null when the text is too short to be worth a lookup,
 * which also keeps a half-typed house number from spending the Geoapify quota.
 */
export function normalizeQuery(raw: string): string | null {
  const q = raw.replace(/\s+/g, ' ').trim();
  return q.length >= MIN_QUERY_LENGTH ? q.slice(0, MAX_QUERY_LENGTH) : null;
}

// The slice of a Geoapify result we read. Every field is optional because Geoapify leaves out
// whatever it doesn't know: a city-level match has no street, a rural address may have a town or
// village instead of a city.
const geoapifyResultSchema = z
  .object({
    housenumber: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    town: z.string().optional(),
    village: z.string().optional(),
    state: z.string().optional(),
    state_code: z.string().optional(),
    postcode: z.string().optional(),
    country: z.string().optional(),
    country_code: z.string().optional(),
  })
  .passthrough();

/** Country names in the same form the store's address forms already use. */
function countryName(code: string | undefined, name: string | undefined): string {
  if (code?.toLowerCase() === 'us') return 'United States';
  return (name ?? '').trim();
}

/**
 * One Geoapify result -> a suggestion that drops straight into an address form, or null when it
 * is not a usable shipping address. A suggestion needs a street, a city and a postcode; anything
 * vaguer (a city, a region, a road with no number in a town Geoapify can't name) would leave the
 * shopper filling in the hard part themselves while looking like it had done it for them.
 */
export function toSuggestion(raw: unknown): AddressSuggestion | null {
  const parsed = geoapifyResultSchema.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;

  const street = [r.housenumber, r.street].filter((p) => p && p.trim()).join(' ').trim();
  const city = (r.city ?? r.town ?? r.village ?? '').trim();
  const zip = (r.postcode ?? '').trim();
  if (!street || !city || !zip) return null;

  // Shipping forms use the two-letter state; fall back to the full name where there is no code.
  const state = (r.state_code ? r.state_code.toUpperCase() : (r.state ?? '')).trim();
  const country = countryName(r.country_code, r.country);

  return {
    label: `${street}, ${city}${state ? `, ${state}` : ''} ${zip}`,
    street,
    city,
    state,
    zip,
    country,
  };
}

/**
 * Maps a batch of results, drops unusable ones, and removes duplicates. Geoapify often returns
 * several points of interest at one address ("Building 41" and the campus around it); they fill
 * in identical fields, so showing both would only be noise.
 */
export function toSuggestions(results: unknown[]): AddressSuggestion[] {
  const seen = new Set<string>();
  const out: AddressSuggestion[] = [];
  for (const raw of results) {
    const s = toSuggestion(raw);
    if (!s) continue;
    const key = [s.street, s.city, s.state, s.zip].join('|').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Looks the text up with Geoapify (United States only, matching where the store ships).
 *
 * Never throws and never puts the API key anywhere it could surface: the URL holding the key is
 * built here and is not logged, and any failure becomes an empty list. `fetchImpl` and `apiKey`
 * are parameters so the failure paths can be tested without the network.
 */
export async function suggestAddresses(
  rawQuery: string,
  opts: { apiKey?: string; fetchImpl?: FetchLike; timeoutMs?: number } = {}
): Promise<AddressSuggestion[]> {
  const query = normalizeQuery(rawQuery);
  if (!query) return [];

  const apiKey = opts.apiKey ?? process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return [];

  const url = new URL(GEOAPIFY_URL);
  url.searchParams.set('text', query);
  url.searchParams.set('filter', 'countrycode:us');
  url.searchParams.set('limit', '10');
  url.searchParams.set('format', 'json');
  url.searchParams.set('apiKey', apiKey);

  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? GEOAPIFY_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url.toString(), { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) {
      // Status only - the request URL carries the key and must not reach the logs.
      console.warn(`[address-suggest] Geoapify answered ${res.status}`);
      return [];
    }
    const body = (await res.json()) as { results?: unknown };
    return Array.isArray(body.results) ? toSuggestions(body.results) : [];
  } catch (err) {
    const reason = err instanceof Error && err.name === 'AbortError' ? 'timed out' : 'failed';
    console.warn(`[address-suggest] Geoapify lookup ${reason}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
