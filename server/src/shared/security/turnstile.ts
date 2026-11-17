// server/src/shared/security/turnstile.ts
// Cloudflare Turnstile: a privacy-friendly CAPTCHA. The browser widget (components/turnstile.tsx)
// produces a one-time token; the server sends it to Cloudflare to check it was solved by a person
// on our site, recently, and not used before.
//
// The token comes in the `x-turnstile-token` header so the endpoints' JSON schemas stay the same.
//
// Switched on by TURNSTILE_SECRET_KEY. Without it (local development, unit tests) the check is
// skipped. When it IS set, every protected request must carry a valid token: a missing or bad
// token is refused, and so is a request made while Cloudflare can't be reached (fail closed).
// Previews use Cloudflare's published always-pass test keys; bookwrms.store uses the real ones.
import { AppError } from '../errors/app-error';

export const TURNSTILE_HEADER = 'x-turnstile-token';
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export class BotCheckError extends AppError {
  constructor(message = 'Please complete the security check and try again.') {
    super(message, 400);
  }
}

export function turnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

type VerifyResponse = { success: boolean; 'error-codes'?: string[]; action?: string; hostname?: string };

/** Throws BotCheckError unless the request carries a token Cloudflare accepts. */
export async function requireHuman(req: Request, ip: string | null, action?: string): Promise<void> {
  if (!turnstileEnabled()) return;
  const token = req.headers.get(TURNSTILE_HEADER)?.trim();
  if (!token || token.length > 2048) throw new BotCheckError();

  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
  if (ip && ip !== 'local') body.set('remoteip', ip);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  let result: VerifyResponse;
  try {
    const res = await fetch(VERIFY_URL, { method: 'POST', body, signal: controller.signal });
    result = (await res.json()) as VerifyResponse;
  } catch (err) {
    console.error('[turnstile] verification unreachable', (err as Error).name);
    throw new BotCheckError('We couldn\'t run the security check. Please try again in a moment.');
  } finally {
    clearTimeout(timer);
  }

  if (!result.success) {
    console.warn('[turnstile] rejected', { action, codes: result['error-codes'] });
    throw new BotCheckError();
  }
  // A token minted for one form can't be replayed on another (test keys don't set an action)
  if (action && result.action && result.action !== action) {
    console.warn('[turnstile] action mismatch', { expected: action, got: result.action });
    throw new BotCheckError();
  }
}
