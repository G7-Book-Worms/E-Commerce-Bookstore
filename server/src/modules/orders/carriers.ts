// Shipping carriers and tracking numbers (session 4).
//
// Pure functions only — no database, no network, no `server-only`, so client components
// (the account Orders tab, the staff order form) import this file directly.
//
// IMPORTANT: `orders` has a `tracking_number` column but **no `carrier` column**, and this
// sprint may not change the schema or add a migration. So the carrier travels inside the
// same varchar(100) as a short prefix: `"ups:1Z999AA10123456784"`. `parseShipment` reads
// both that form and the bare numbers older rows already hold (guessing the carrier from
// the number's shape in that case), and `formatShipment` writes the prefixed form.
//
// No carrier API is ever called: the only thing built from a tracking number is a link to
// the carrier's own public tracking page, from the fixed allow-list below.

export const CARRIERS = ['ups', 'fedex', 'usps', 'dhl'] as const;
export type Carrier = (typeof CARRIERS)[number];

export const CARRIER_LABELS: Record<Carrier, string> = {
  ups: 'UPS',
  fedex: 'FedEx',
  usps: 'USPS',
  dhl: 'DHL',
};

/**
 * Allow-list of public tracking pages. The tracking number is the only thing interpolated,
 * and it is URL-encoded first; nothing user-supplied ever reaches the host or path.
 */
const TRACKING_URLS: Record<Carrier, (encoded: string) => string> = {
  ups: (n) => `https://www.ups.com/track?loc=en_US&requester=ST&tracknum=${n}`,
  fedex: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
  usps: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`,
  dhl: (n) => `https://www.dhl.com/us-en/home/tracking/tracking-express.html?tracking-id=${n}`,
};

export function isCarrier(value: unknown): value is Carrier {
  return typeof value === 'string' && (CARRIERS as readonly string[]).includes(value);
}

/**
 * Tracking numbers as the carriers print them: spaces and dashes are cosmetic, letters are
 * upper-case. Everything that is not a letter or a digit is dropped before validating,
 * storing or linking, so a number pasted out of an email still works.
 */
export function normalizeTrackingNumber(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

/**
 * Shapes each carrier actually issues. Permissive on purpose — the point is to catch a
 * truncated or half-pasted number, not to reject a legitimate one. A number that passes
 * here can still be unknown to the carrier; only the carrier can say that.
 */
const PATTERNS: Record<Carrier, RegExp[]> = {
  // 1Z + shipper number + service + 8-digit id; also UPS "T" numbers and the 9/12-digit
  // reference and Mail Innovations formats.
  ups: [/^1Z[0-9A-Z]{16}$/, /^T[0-9A-Z]{10}$/, /^\d{9}$/, /^\d{12}$/, /^\d{18}$/],
  // Express (12), Ground (15), Ground 96-prefixed (20) and SmartPost (20/22).
  fedex: [/^\d{12}$/, /^\d{15}$/, /^\d{20}$/, /^\d{22}$/, /^\d{34}$/],
  // Domestic IMpb (20-22 digits, usually 92/93/94/95-prefixed), Certified Mail (26),
  // and S10 international (2 letters + 9 digits + 2 letters).
  usps: [/^\d{20}$/, /^\d{22}$/, /^\d{26}$/, /^\d{30}$/, /^[A-Z]{2}\d{9}[A-Z]{2}$/],
  // Express air waybills (10/11 digits), eCommerce (GM/JD + alphanumerics).
  dhl: [/^\d{10}$/, /^\d{11}$/, /^JD\d{18}$/, /^JVGL\d{10,20}$/, /^GM\d{14,24}$/],
};

export interface TrackingValidation {
  ok: boolean;
  /** The cleaned number, safe to store. Empty when the input was blank. */
  value: string;
  /** A message to show the staff member. Only set when `ok` is false. */
  error?: string;
}

/**
 * Checks a tracking number against the shapes its carrier issues.
 *
 * A blank number is valid — tracking is optional, an order can be marked shipped without one.
 */
export function validateTrackingNumber(carrier: unknown, raw: string | null | undefined): TrackingValidation {
  const value = normalizeTrackingNumber(raw);
  if (!value) return { ok: true, value: '' };
  if (!isCarrier(carrier)) {
    return { ok: false, value, error: 'Choose the carrier this number belongs to.' };
  }
  if (value.length > 60) {
    return { ok: false, value, error: 'That tracking number is too long to be real.' };
  }
  if (!PATTERNS[carrier].some((re) => re.test(value))) {
    return {
      ok: false,
      value,
      error: `That doesn't look like a ${CARRIER_LABELS[carrier]} tracking number. Check for a missing or extra digit.`,
    };
  }
  return { ok: true, value };
}

/**
 * The carrier a bare tracking number most likely belongs to, for rows saved before the
 * carrier was recorded. Returns null when the shape fits several carriers or none, so the
 * UI shows the number without a misleading link rather than guessing wrong.
 */
export function inferCarrier(raw: string | null | undefined): Carrier | null {
  const value = normalizeTrackingNumber(raw);
  if (!value) return null;
  const matches = CARRIERS.filter((c) => PATTERNS[c].some((re) => re.test(value)));
  return matches.length === 1 ? matches[0] : null;
}

/** What `orders.tracking_number` holds, unpacked. */
export interface Shipment {
  carrier: Carrier | null;
  trackingNumber: string;
}

/**
 * Builds the value stored in `orders.tracking_number`: `"<carrier>:<number>"`, or the bare
 * number when no carrier is known, or null when there is no number at all.
 */
export function formatShipment(carrier: unknown, raw: string | null | undefined): string | null {
  const value = normalizeTrackingNumber(raw);
  if (!value) return null;
  return isCarrier(carrier) ? `${carrier}:${value}` : value;
}

/** Reads a stored `tracking_number` back into a carrier and a number. */
export function parseShipment(stored: string | null | undefined): Shipment | null {
  if (!stored) return null;
  const colon = stored.indexOf(':');
  if (colon > 0) {
    const prefix = stored.slice(0, colon).trim().toLowerCase();
    const number = normalizeTrackingNumber(stored.slice(colon + 1));
    if (isCarrier(prefix) && number) return { carrier: prefix, trackingNumber: number };
  }
  const number = normalizeTrackingNumber(stored);
  if (!number) return null;
  return { carrier: inferCarrier(number), trackingNumber: number };
}

/**
 * A link to the carrier's own tracking page, or null when the carrier is unknown or there
 * is no number. The URL template comes from the allow-list above and the number is
 * URL-encoded, so nothing user-supplied can change where the link points.
 */
export function carrierTrackingUrl(carrier: unknown, raw: string | null | undefined): string | null {
  const value = normalizeTrackingNumber(raw);
  if (!value || !isCarrier(carrier)) return null;
  return TRACKING_URLS[carrier](encodeURIComponent(value));
}

/** Everything the UI needs about an order's shipment, from the stored column alone. */
export function shipmentView(stored: string | null | undefined): {
  carrier: Carrier | null;
  carrierLabel: string | null;
  trackingNumber: string;
  trackingUrl: string | null;
} | null {
  const parsed = parseShipment(stored);
  if (!parsed) return null;
  return {
    carrier: parsed.carrier,
    carrierLabel: parsed.carrier ? CARRIER_LABELS[parsed.carrier] : null,
    trackingNumber: parsed.trackingNumber,
    trackingUrl: carrierTrackingUrl(parsed.carrier, parsed.trackingNumber),
  };
}
