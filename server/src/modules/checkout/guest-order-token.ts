// server/src/modules/checkout/guest-order-token.ts
// The "view your order" link in a guest's confirmation email (SCRUM-208).
//
// A guest has no account, so the link itself has to prove which order the holder may see.
// Putting a bare order id in the URL would let anyone read any order by counting upwards
// (an IDOR), so the link carries a signed, expiring JWT instead:
//
//   - signed with HS256 over JWT_SECRET, the same secret and algorithm as the sign-in tokens
//     in server/src/shared/utils/token-util.ts (whose issuer constant is reused below);
//   - audience "guest-order", which is neither "customer" nor "staff", so a login cookie can
//     never be used as an order link and an order link can never be used as a login cookie;
//   - subject = exactly one order id. The view API reads the order id *out of the token* and
//     never from the URL, so one link can only ever open the one order it was signed for;
//   - expires after 30 days, long enough to be useful from an inbox and short enough that an
//     old forwarded email stops working.
//
// Tokens are never logged (see the API routes).
import jwt from 'jsonwebtoken';
import { JWT_ISSUER } from '../../shared/utils/token-util';
import { UnauthorizedError } from '../../shared/errors/app-error';

export const GUEST_ORDER_AUDIENCE = 'guest-order';
export const GUEST_ORDER_TOKEN_LIFETIME = '30d';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET is missing or shorter than 32 characters');
  }
  return secret;
}

/** A link token for exactly one guest order. */
export function signGuestOrderToken(orderId: number): string {
  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new Error('signGuestOrderToken needs a positive integer order id');
  }
  return jwt.sign({ scope: GUEST_ORDER_AUDIENCE }, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: GUEST_ORDER_TOKEN_LIFETIME,
    issuer: JWT_ISSUER,
    audience: GUEST_ORDER_AUDIENCE,
    subject: String(orderId),
  } as jwt.SignOptions);
}

/**
 * Checks the signature, algorithm, issuer, audience and expiry and returns the one order id the
 * token was signed for. Pass `expectedOrderId` to also require that it is that order.
 * Every failure is the same 401 so a caller cannot tell a wrong signature from a wrong order.
 */
export function verifyGuestOrderToken(token: string, expectedOrderId?: number): number {
  let orderId: number;
  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: GUEST_ORDER_AUDIENCE,
    }) as jwt.JwtPayload;
    orderId = Number(payload.sub);
  } catch {
    throw new UnauthorizedError('This order link is invalid or has expired');
  }
  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new UnauthorizedError('This order link is invalid or has expired');
  }
  if (expectedOrderId !== undefined && orderId !== expectedOrderId) {
    throw new UnauthorizedError('This order link is invalid or has expired');
  }
  return orderId;
}
