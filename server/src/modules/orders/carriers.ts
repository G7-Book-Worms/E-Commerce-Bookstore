// Shipping carriers and tracking numbers (session 4).
//
// Pure functions only — no database, no network, no `server-only`, so client components
// (the account Orders tab, the staff order form) import this file directly.
//
// `orders.carrier` holds the carrier and `orders.tracking_number` holds the bare number;
// this file is the only place that knows what either value means.
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
 * A link to the carrier's own tracking page, or null when the carrier is unknown or there
 * is no number. The URL template comes from the allow-list above and the number is
 * URL-encoded, so nothing user-supplied can change where the link points.
 */
export function carrierTrackingUrl(carrier: unknown, raw: string | null | undefined): string | null {
  const value = normalizeTrackingNumber(raw);
  if (!value || !isCarrier(carrier)) return null;
  return TRACKING_URLS[carrier](encodeURIComponent(value));
}

/**
 * Everything the UI needs about an order's shipment, straight from the two columns.
 *
 * Null when there is no tracking number, which is the only thing worth showing: an order
 * can carry a carrier with no number yet, and that is nothing to display.
 */
export function shipmentView(
  carrier: unknown,
  rawTrackingNumber: string | null | undefined
): {
  carrier: Carrier | null;
  carrierLabel: string | null;
  trackingNumber: string;
  trackingUrl: string | null;
} | null {
  const trackingNumber = normalizeTrackingNumber(rawTrackingNumber);
  if (!trackingNumber) return null;
  const known = isCarrier(carrier) ? carrier : null;
  return {
    carrier: known,
    carrierLabel: known ? CARRIER_LABELS[known] : null,
    trackingNumber,
    trackingUrl: carrierTrackingUrl(known, trackingNumber),
  };
}
