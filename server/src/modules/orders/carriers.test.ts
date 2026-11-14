// Run with: pnpm test  (or: npx tsx --test server/src/modules/orders/carriers.test.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARRIERS,
  carrierTrackingUrl,
  formatShipment,
  inferCarrier,
  isCarrier,
  normalizeTrackingNumber,
  parseShipment,
  shipmentView,
  validateTrackingNumber,
} from './carriers';
import { ORDER_STAGES, orderProgress } from './order-progress';

// Real-looking numbers in each carrier's published format.
const UPS = '1Z999AA10123456784';
const FEDEX = '390123456789'; // 12-digit Express
const USPS = '94001234567890123456'; // 20-digit IMpb
const DHL = '1234567890'; // 10-digit air waybill

// --- carrierTrackingUrl -----------------------------------------------------

test('each carrier gets its own real tracking page, with the number in the query', () => {
  assert.equal(
    carrierTrackingUrl('ups', UPS),
    `https://www.ups.com/track?loc=en_US&requester=ST&tracknum=${UPS}`
  );
  assert.equal(carrierTrackingUrl('fedex', FEDEX), `https://www.fedex.com/fedextrack/?trknbr=${FEDEX}`);
  assert.equal(
    carrierTrackingUrl('usps', USPS),
    `https://tools.usps.com/go/TrackConfirmAction?tLabels=${USPS}`
  );
  assert.equal(
    carrierTrackingUrl('dhl', DHL),
    `https://www.dhl.com/us-en/home/tracking/tracking-express.html?tracking-id=${DHL}`
  );
});

test('every carrier in the enum has a template, and every link is https to that carrier', () => {
  const hosts: Record<string, string> = {
    ups: 'www.ups.com',
    fedex: 'www.fedex.com',
    usps: 'tools.usps.com',
    dhl: 'www.dhl.com',
  };
  for (const carrier of CARRIERS) {
    const url = carrierTrackingUrl(carrier, UPS);
    assert.ok(url, `${carrier} has no tracking URL`);
    const parsed = new URL(url!);
    assert.equal(parsed.protocol, 'https:');
    assert.equal(parsed.host, hosts[carrier]);
  }
});

test('an unknown carrier gets no link rather than a guessed one', () => {
  assert.equal(carrierTrackingUrl('royalmail', UPS), null);
  assert.equal(carrierTrackingUrl('', UPS), null);
  assert.equal(carrierTrackingUrl(undefined, UPS), null);
  assert.equal(carrierTrackingUrl(null, UPS), null);
  assert.equal(carrierTrackingUrl('UPS', UPS), null, 'the enum is lower-case only');
  assert.equal(carrierTrackingUrl({ toString: () => 'ups' }, UPS), null);
});

test('a missing tracking number gets no link', () => {
  assert.equal(carrierTrackingUrl('ups', null), null);
  assert.equal(carrierTrackingUrl('ups', undefined), null);
  assert.equal(carrierTrackingUrl('ups', ''), null);
  assert.equal(carrierTrackingUrl('ups', '   '), null);
  assert.equal(carrierTrackingUrl('ups', '- -'), null);
});

test('the tracking number is URL-encoded, so it cannot steer the link elsewhere', () => {
  // Normalising already strips punctuation, so an injected query or path never survives;
  // this pins both defences at once.
  const url = carrierTrackingUrl('ups', '1Z999&redirect=https://evil.example/x');
  assert.ok(url);
  const parsed = new URL(url!);
  assert.equal(parsed.host, 'www.ups.com');
  assert.equal(parsed.searchParams.get('redirect'), null);
  assert.equal(parsed.searchParams.get('tracknum'), '1Z999REDIRECTHTTPSEVILEXAMPLEX');
  assert.ok(!url!.includes('evil.example/'));
});

// --- normalizeTrackingNumber ------------------------------------------------

test('spaces, dashes and case are cosmetic', () => {
  assert.equal(normalizeTrackingNumber(' 1z 999-aa10 123456784 '), UPS);
  assert.equal(normalizeTrackingNumber('9400 1234 5678 9012 3456'), USPS);
  assert.equal(normalizeTrackingNumber(null), '');
  assert.equal(normalizeTrackingNumber(undefined), '');
});

test('a number pasted with its label still validates and links', () => {
  const v = validateTrackingNumber('ups', '1Z 999 AA1 01 2345 6784');
  assert.equal(v.ok, true);
  assert.equal(v.value, UPS);
});

// --- validateTrackingNumber -------------------------------------------------

test('a genuine number for each carrier is accepted', () => {
  assert.equal(validateTrackingNumber('ups', UPS).ok, true);
  assert.equal(validateTrackingNumber('ups', 'T1234567890').ok, true);
  assert.equal(validateTrackingNumber('fedex', FEDEX).ok, true);
  assert.equal(validateTrackingNumber('fedex', '123456789012345').ok, true);
  assert.equal(validateTrackingNumber('usps', USPS).ok, true);
  assert.equal(validateTrackingNumber('usps', 'LZ123456789US').ok, true);
  assert.equal(validateTrackingNumber('dhl', DHL).ok, true);
  assert.equal(validateTrackingNumber('dhl', 'JD011600000123456789').ok, true);
});

test('a blank number is valid: tracking is optional', () => {
  const v = validateTrackingNumber('ups', '');
  assert.equal(v.ok, true);
  assert.equal(v.value, '');
  assert.equal(validateTrackingNumber('ups', null).ok, true);
  assert.equal(validateTrackingNumber(undefined, '').ok, true, 'no carrier and no number is fine');
});

test('a paste error is caught', () => {
  assert.equal(validateTrackingNumber('ups', '1Z999AA101234567').ok, false, 'one digit short');
  assert.equal(validateTrackingNumber('ups', '1Z999AA101234567845').ok, false, 'one digit long');
  assert.equal(validateTrackingNumber('fedex', '39012345678').ok, false, '11 digits is not a FedEx format');
  assert.equal(validateTrackingNumber('usps', '940012345678901234').ok, false, '18 digits is not an IMpb');
  assert.equal(validateTrackingNumber('dhl', '123456789').ok, false, '9 digits is not an air waybill');
  assert.equal(validateTrackingNumber('ups', 'see attached email').ok, false);
  assert.equal(validateTrackingNumber('ups', '1'.repeat(80)).ok, false, 'absurdly long');
});

test('a rejected number comes back with a message naming the carrier', () => {
  const v = validateTrackingNumber('fedex', '12345');
  assert.equal(v.ok, false);
  assert.match(v.error ?? '', /FedEx/);
});

test('a number without a carrier is rejected, and says so', () => {
  const v = validateTrackingNumber(null, UPS);
  assert.equal(v.ok, false);
  assert.match(v.error ?? '', /carrier/i);
});

test('one carrier does not accept another carrier shape it never issues', () => {
  assert.equal(validateTrackingNumber('fedex', UPS).ok, false);
  assert.equal(validateTrackingNumber('dhl', UPS).ok, false);
  assert.equal(validateTrackingNumber('usps', DHL).ok, false);
});

// --- isCarrier --------------------------------------------------------------

test('isCarrier only passes the four real carriers', () => {
  for (const c of CARRIERS) assert.equal(isCarrier(c), true);
  for (const bad of ['UPS', 'ontrac', '', 'ups ', 0, null, undefined, {}, ['ups']]) {
    assert.equal(isCarrier(bad), false, `${JSON.stringify(bad)} should not be a carrier`);
  }
});

// --- formatShipment / parseShipment ----------------------------------------

test('the carrier is stored alongside the number and read back', () => {
  const stored = formatShipment('ups', '1z999aa1-0123456784');
  assert.equal(stored, `ups:${UPS}`);
  assert.deepEqual(parseShipment(stored), { carrier: 'ups', trackingNumber: UPS });
});

test('no number means nothing is stored', () => {
  assert.equal(formatShipment('ups', ''), null);
  assert.equal(formatShipment('ups', null), null);
  assert.equal(formatShipment('ups', '  -- '), null);
  assert.equal(parseShipment(null), null);
  assert.equal(parseShipment(''), null);
});

test('an unknown carrier is dropped rather than stored, and the number is kept', () => {
  assert.equal(formatShipment('ontrac', UPS), UPS);
  assert.equal(formatShipment(null, FEDEX), FEDEX);
});

test('a bare number saved before carriers existed still reads back', () => {
  // Unambiguous shape: the carrier is inferred so the link still works.
  assert.deepEqual(parseShipment(UPS), { carrier: 'ups', trackingNumber: UPS });
  // Ambiguous shape (20 digits is both FedEx and USPS): no carrier, so no misleading link.
  assert.deepEqual(parseShipment(USPS), { carrier: null, trackingNumber: USPS });
});

test('a bogus prefix is not mistaken for a carrier', () => {
  // "evil" is not in the enum, so the prefix is not honoured. The whole string is treated
  // as one number, which matches no carrier shape, so there is no carrier and no link.
  assert.deepEqual(parseShipment(`evil:${UPS}`), { carrier: null, trackingNumber: `EVIL${UPS}` });
  assert.equal(shipmentView(`evil:${UPS}`)?.trackingUrl, null);
  // A prefix with no number behind it is not a shipment with a carrier.
  assert.deepEqual(parseShipment('ups:'), { carrier: null, trackingNumber: 'UPS' });
});

test('inferCarrier refuses to guess when the shape fits more than one carrier', () => {
  assert.equal(inferCarrier(UPS), 'ups');
  assert.equal(inferCarrier(DHL), 'dhl');
  assert.equal(inferCarrier(USPS), null, '20 digits is FedEx SmartPost or USPS IMpb');
  assert.equal(inferCarrier('nonsense'), null);
  assert.equal(inferCarrier(''), null);
  assert.equal(inferCarrier(null), null);
});

// --- shipmentView -----------------------------------------------------------

test('shipmentView gives the UI a label, a number and a link in one go', () => {
  assert.deepEqual(shipmentView(`fedex:${FEDEX}`), {
    carrier: 'fedex',
    carrierLabel: 'FedEx',
    trackingNumber: FEDEX,
    trackingUrl: `https://www.fedex.com/fedextrack/?trknbr=${FEDEX}`,
  });
});

test('shipmentView shows a number with no link when the carrier is unknown', () => {
  const view = shipmentView(USPS);
  assert.deepEqual(view, {
    carrier: null,
    carrierLabel: null,
    trackingNumber: USPS,
    trackingUrl: null,
  });
});

test('shipmentView is null when there is nothing to show', () => {
  assert.equal(shipmentView(null), null);
  assert.equal(shipmentView(''), null);
});

// --- orderProgress ----------------------------------------------------------

test('the line has exactly the three real forward stages', () => {
  assert.deepEqual([...ORDER_STAGES], ['pending', 'transit', 'arrived']);
  assert.equal(orderProgress('pending').steps.length, 3);
});

test('a pending order has only its first dot filled', () => {
  const p = orderProgress('pending');
  assert.equal(p.cancelled, false);
  assert.deepEqual(p.steps.map((s) => s.done), [true, false, false]);
  assert.deepEqual(p.steps.map((s) => s.current), [true, false, false]);
  assert.equal(p.percent, 0);
});

test('a shipped order is halfway along', () => {
  const p = orderProgress('transit');
  assert.deepEqual(p.steps.map((s) => s.done), [true, true, false]);
  assert.equal(p.steps[1].current, true);
  assert.equal(p.percent, 50);
});

test('a delivered order fills the line', () => {
  const p = orderProgress('arrived');
  assert.deepEqual(p.steps.map((s) => s.done), [true, true, true]);
  assert.equal(p.percent, 100);
});

test('cancelled is a terminal state, not a stage on the line', () => {
  const p = orderProgress('cancelled');
  assert.equal(p.cancelled, true);
  assert.equal(p.percent, 0);
  assert.equal(p.steps.some((s) => s.done || s.current), false);
  assert.equal(p.steps.some((s) => s.stage === ('cancelled' as never)), false);
});

test('an unrecognised status falls back to the first stage instead of throwing', () => {
  for (const bad of ['refunded', '', null, undefined]) {
    const p = orderProgress(bad);
    assert.equal(p.cancelled, false);
    assert.equal(p.steps[0].current, true);
  }
});
