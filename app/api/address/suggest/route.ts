// POST /api/address/suggest { q } -> up to 5 US street addresses matching what has been typed
//
// Used by address forms at checkout (guests included) and in the account Addresses tab, so it is
// unauthenticated. The typed text travels in the body rather than a query string so that people's
// partial home addresses don't end up in request logs. See address-suggest.ts for why every
// failure is an empty list rather than an error.
import { NextRequest } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { validateBody } from '@/server/src/shared/middleware/validate-middleware';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { rateLimit, TooManyRequestsError } from '@/server/src/shared/security/rate-limit';
import { clientIp } from '@/server/src/shared/security/client-ip';
import {
  addressSuggestSchema,
  normalizeQuery,
  suggestAddresses,
} from '@/server/src/modules/address/address-suggest';

// Geoapify's free plan allows about 3,000 lookups a day. Per-IP limiting stops one visitor
// hammering it; the global daily cap, kept below the plan limit, stops someone rotating IPs from
// using up the quota and switching autocomplete off for everyone.
const PER_IP_PER_HOUR = 60;
const GLOBAL_PER_DAY = 2500;

export const POST = createApiHandler(async (req: NextRequest) => {
  await rateLimit(`address:suggest:ip:${clientIp(req)}`, PER_IP_PER_HOUR, 3600);

  const { q } = await validateBody(req, addressSuggestSchema);
  // Too short to look up: answer without touching Geoapify or the shared quota.
  if (!normalizeQuery(q)) return HttpResponse.success({ suggestions: [] }, 'Keep typing');

  try {
    await rateLimit('address:suggest:global', GLOBAL_PER_DAY, 24 * 3600);
  } catch (err) {
    // Out of daily quota: autocomplete quietly switches off; typing the address still works.
    if (err instanceof TooManyRequestsError) {
      return HttpResponse.success({ suggestions: [] }, 'Suggestions unavailable');
    }
    throw err;
  }

  const suggestions = await suggestAddresses(q);
  return HttpResponse.success({ suggestions }, 'Suggestions');
});
