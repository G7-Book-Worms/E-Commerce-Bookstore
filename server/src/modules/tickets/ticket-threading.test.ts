// Unit tests for the pure threading functions. Run with:
//   npx tsx --test server/src/modules/tickets/ticket-threading.test.ts
//
// There is no database in this environment, so this file is where the matching logic is
// actually verified. It is the part most likely to be wrong: inbound headers come from
// whatever mail client the customer happens to use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReferences,
  buildReplySubject,
  cleanInboundBody,
  isMachineMail,
  matchInboundToThread,
  normalizeMessageId,
  parseMessageIdList,
  parseRawHeaders,
  parseTicketNumberFromSubject,
  senderDisplayName,
  type ThreadLookup,
} from './ticket-threading';

/** A lookup with two tickets: #1001 (ticketId 7) and #1002 (ticketId 9). */
function lookup(): ThreadLookup {
  return {
    byMessageId: new Map([
      ['out-root@bookwrms.store', 7],   // our first reply on ticket 7
      ['out-second@bookwrms.store', 7], // our second reply on ticket 7
      ['in-customer@mail.example', 7],  // the customer's reply we stored
      ['other@bookwrms.store', 9],      // a message on ticket 9
    ]),
    byTicketNumber: new Map([
      [1001, 7],
      [1002, 9],
    ]),
  };
}

// ---------------------------------------------------------------- normalizeMessageId

test('normalizeMessageId strips brackets and whitespace', () => {
  assert.equal(normalizeMessageId('<abc@example.com>'), 'abc@example.com');
  assert.equal(normalizeMessageId('  <abc@example.com>  '), 'abc@example.com');
  assert.equal(normalizeMessageId('abc@example.com'), 'abc@example.com');
});

test('normalizeMessageId tolerates malformed brackets', () => {
  assert.equal(normalizeMessageId('<abc@example.com'), 'abc@example.com');
  assert.equal(normalizeMessageId('abc@example.com>'), 'abc@example.com');
  assert.equal(normalizeMessageId('<<abc@example.com>>'), 'abc@example.com');
});

test('normalizeMessageId rejects things that cannot be ids', () => {
  assert.equal(normalizeMessageId(null), null);
  assert.equal(normalizeMessageId(undefined), null);
  assert.equal(normalizeMessageId(''), null);
  assert.equal(normalizeMessageId('   '), null);
  assert.equal(normalizeMessageId('<>'), null);
  assert.equal(normalizeMessageId('no-at-sign'), null);
  assert.equal(normalizeMessageId('<has space@example.com>'), null);
  // Longer than the varchar(255) column it would have to match against.
  assert.equal(normalizeMessageId(`${'x'.repeat(260)}@example.com`), null);
});

test('normalizeMessageId preserves case, because Message-IDs are case-sensitive', () => {
  assert.equal(normalizeMessageId('<AbC@Example.COM>'), 'AbC@Example.COM');
});

// ---------------------------------------------------------------- parseMessageIdList

test('parseMessageIdList reads a well-formed References chain in order', () => {
  assert.deepEqual(parseMessageIdList('<a@x> <b@x> <c@x>'), ['a@x', 'b@x', 'c@x']);
});

test('parseMessageIdList handles folded, comma-separated and bare ids', () => {
  assert.deepEqual(parseMessageIdList('<a@x>,\r\n <b@x>'), ['a@x', 'b@x']);
  assert.deepEqual(parseMessageIdList('a@x b@x'), ['a@x', 'b@x']);
  assert.deepEqual(parseMessageIdList('<a@x> b@x'), ['a@x', 'b@x']);
});

test('parseMessageIdList removes duplicates, keeping the first position', () => {
  assert.deepEqual(parseMessageIdList('<a@x> <b@x> <a@x>'), ['a@x', 'b@x']);
});

test('parseMessageIdList survives malformed input', () => {
  assert.deepEqual(parseMessageIdList(null), []);
  assert.deepEqual(parseMessageIdList(undefined), []);
  assert.deepEqual(parseMessageIdList(''), []);
  assert.deepEqual(parseMessageIdList('   '), []);
  assert.deepEqual(parseMessageIdList('<>'), []);
  assert.deepEqual(parseMessageIdList('garbage without an at sign'), []);
  // An unterminated bracket at the end of a truncated header still yields the id.
  assert.deepEqual(parseMessageIdList('<a@x> <b@x'), ['a@x', 'b@x']);
  // Nested brackets do not loop or throw.
  assert.deepEqual(parseMessageIdList('<<a@x>>'), ['a@x']);
});

// ---------------------------------------------------------------- subject token

test('parseTicketNumberFromSubject reads the token', () => {
  assert.equal(parseTicketNumberFromSubject('Re: [Ticket #1001] Where is my order'), 1001);
  assert.equal(parseTicketNumberFromSubject('[ticket #1001] lowercase'), 1001);
  assert.equal(parseTicketNumberFromSubject('[Ticket  #  1001 ] spaced out'), 1001);
  assert.equal(parseTicketNumberFromSubject('Fwd: Re: [Ticket #1002] nested prefixes'), 1002);
});

test('parseTicketNumberFromSubject returns null when there is no usable token', () => {
  assert.equal(parseTicketNumberFromSubject(null), null);
  assert.equal(parseTicketNumberFromSubject(undefined), null);
  assert.equal(parseTicketNumberFromSubject(''), null);
  assert.equal(parseTicketNumberFromSubject('No token here'), null);
  assert.equal(parseTicketNumberFromSubject('[Ticket #] empty'), null);
  assert.equal(parseTicketNumberFromSubject('[Ticket #abc] not a number'), null);
  // At or below the base, so not a real ticket number.
  assert.equal(parseTicketNumberFromSubject('[Ticket #1000] at the base'), null);
  assert.equal(parseTicketNumberFromSubject('[Ticket #0] zero'), null);
  // Too big for the int column: must not be handed on to a query.
  assert.equal(parseTicketNumberFromSubject('[Ticket #999999999999] overflow'), null);
});

// ---------------------------------------------------------------- matchInboundToThread

test('matches on In-Reply-To', () => {
  const m = matchInboundToThread({ subject: 'Re: anything', inReplyTo: '<out-root@bookwrms.store>' }, lookup());
  assert.deepEqual(m, { kind: 'header', ticketId: 7, via: 'in-reply-to', messageId: 'out-root@bookwrms.store' });
});

test('matches on References when In-Reply-To is missing', () => {
  const m = matchInboundToThread({ subject: 'Re: anything', references: '<unknown@x> <out-root@bookwrms.store>' }, lookup());
  assert.deepEqual(m, { kind: 'header', ticketId: 7, via: 'references', messageId: 'out-root@bookwrms.store' });
});

test('a reply to a reply matches the nearest known ancestor, not the root', () => {
  // The customer replied to our second message; References holds the whole chain.
  const m = matchInboundToThread(
    { subject: 'Re: [Ticket #1001] hello', references: '<out-root@bookwrms.store> <in-customer@mail.example> <out-second@bookwrms.store>' },
    lookup()
  );
  assert.equal(m.kind, 'header');
  assert.equal(m.kind === 'header' && m.via, 'references');
  // Walked from the end, so it is the most recent ancestor that matched.
  assert.equal(m.kind === 'header' && m.messageId, 'out-second@bookwrms.store');
});

test('In-Reply-To wins over References when they disagree', () => {
  const m = matchInboundToThread(
    { inReplyTo: '<other@bookwrms.store>', references: '<out-root@bookwrms.store>' },
    lookup()
  );
  assert.deepEqual(m, { kind: 'header', ticketId: 9, via: 'in-reply-to', messageId: 'other@bookwrms.store' });
});

test('headers win over a subject token that points somewhere else', () => {
  // Subject says #1002 but the headers say ticket 7. Trust the headers.
  const m = matchInboundToThread(
    { subject: 'Re: [Ticket #1002] spoofed', inReplyTo: '<out-root@bookwrms.store>' },
    lookup()
  );
  assert.equal(m.kind === 'header' && m.ticketId, 7);
});

test('falls back to the subject token when the headers are absent', () => {
  const m = matchInboundToThread({ subject: 'Re: [Ticket #1001] my order' }, lookup());
  assert.deepEqual(m, { kind: 'subject', ticketId: 7, ticketNumber: 1001 });
});

test('falls back to the subject token when the headers are present but unknown', () => {
  const m = matchInboundToThread(
    { subject: 'Re: [Ticket #1002] my order', inReplyTo: '<never-seen@elsewhere.test>', references: '<also-unknown@elsewhere.test>' },
    lookup()
  );
  assert.deepEqual(m, { kind: 'subject', ticketId: 9, ticketNumber: 1002 });
});

test('a subject token for a ticket that does not exist is reported, never matched', () => {
  const m = matchInboundToThread({ subject: 'Re: [Ticket #4242] nonsense' }, lookup());
  assert.deepEqual(m, { kind: 'none', ticketNumber: 4242 });
});

test('no headers and no token is a new thread', () => {
  const m = matchInboundToThread({ subject: 'A brand new question' }, lookup());
  assert.deepEqual(m, { kind: 'none', ticketNumber: null });
});

test('completely empty and malformed headers do not throw', () => {
  assert.deepEqual(matchInboundToThread({}, lookup()), { kind: 'none', ticketNumber: null });
  assert.deepEqual(
    matchInboundToThread({ subject: null, inReplyTo: null, references: null }, lookup()),
    { kind: 'none', ticketNumber: null }
  );
  assert.deepEqual(
    matchInboundToThread({ subject: '', inReplyTo: '<>', references: 'garbage' }, lookup()),
    { kind: 'none', ticketNumber: null }
  );
  assert.deepEqual(
    matchInboundToThread({ inReplyTo: '<<>>', references: '<a b c@x>' }, lookup()),
    { kind: 'none', ticketNumber: null }
  );
});

test('matching against an empty lookup never matches', () => {
  const empty: ThreadLookup = { byMessageId: new Map(), byTicketNumber: new Map() };
  assert.deepEqual(
    matchInboundToThread({ subject: 'Re: [Ticket #1001] x', inReplyTo: '<out-root@bookwrms.store>' }, empty),
    { kind: 'none', ticketNumber: 1001 }
  );
});

test('Message-ID matching is case-sensitive, so a rewritten id does not match', () => {
  const m = matchInboundToThread({ inReplyTo: '<OUT-ROOT@BOOKWRMS.STORE>' }, lookup());
  assert.deepEqual(m, { kind: 'none', ticketNumber: null });
});

// ---------------------------------------------------------------- outbound subject / references

test('buildReplySubject adds the token once', () => {
  assert.equal(buildReplySubject(1001, 'Where is my order'), 'Re: [Ticket #1001] Where is my order');
});

test('buildReplySubject does not stack prefixes or tokens', () => {
  assert.equal(buildReplySubject(1001, 'Re: [Ticket #1001] Where is my order'), 'Re: [Ticket #1001] Where is my order');
  assert.equal(buildReplySubject(1001, 'Re: Re: Fwd: [Ticket #1001] Hello'), 'Re: [Ticket #1001] Hello');
  assert.equal(buildReplySubject(1001, 'RE: AW: Hello'), 'Re: [Ticket #1001] Hello');
});

test('buildReplySubject copes with an empty subject', () => {
  assert.equal(buildReplySubject(1001, ''), 'Re: [Ticket #1001]');
  assert.equal(buildReplySubject(1001, '   '), 'Re: [Ticket #1001]');
});

test('buildReferences appends the parent to the existing chain', () => {
  assert.equal(buildReferences('<a@x> <b@x>', '<c@x>'), '<a@x> <b@x> <c@x>');
});

test('buildReferences does not repeat the parent', () => {
  assert.equal(buildReferences('<a@x> <c@x>', '<c@x>'), '<a@x> <c@x>');
});

test('buildReferences handles the first reply on a thread', () => {
  assert.equal(buildReferences(null, '<c@x>'), '<c@x>');
  assert.equal(buildReferences(null, null), null);
  assert.equal(buildReferences('', ''), null);
});

test('buildReferences keeps the root and caps the chain length', () => {
  const chain = Array.from({ length: 30 }, (_, i) => `<id${i}@x>`).join(' ');
  const out = buildReferences(chain, '<parent@x>')!;
  const ids = out.split(' ');
  assert.equal(ids.length, 12);
  assert.equal(ids[0], '<id0@x>');
  assert.equal(ids[ids.length - 1], '<parent@x>');
});

// ---------------------------------------------------------------- machine mail

test('isMachineMail recognises DMARC and TLS reports', () => {
  assert.equal(isMachineMail({ subject: 'Report domain: bookwrms.store Submitter: google.com' }), true);
  assert.equal(isMachineMail({ subject: 'DMARC Aggregate Report for bookwrms.store' }), true);
  assert.equal(isMachineMail({ subject: 'SMTP TLS Report for bookwrms.store' }), true);
  assert.equal(isMachineMail({ fromEmail: 'dmarcreports@microsoft.com', subject: 'anything' }), true);
});

test('isMachineMail recognises bounces and auto-replies', () => {
  assert.equal(isMachineMail({ fromEmail: 'MAILER-DAEMON@mail.example' }), true);
  assert.equal(isMachineMail({ subject: 'Undelivered Mail Returned to Sender' }), true);
  assert.equal(isMachineMail({ subject: 'Automatic reply: your message' }), true);
  assert.equal(isMachineMail({ subject: 'Out of Office: back Monday' }), true);
  assert.equal(isMachineMail({ autoSubmitted: 'auto-replied' }), true);
  assert.equal(isMachineMail({ precedence: 'bulk' }), true);
});

test('isMachineMail leaves real customer mail alone', () => {
  assert.equal(isMachineMail({ subject: 'Where is my order?', fromEmail: 'ada@example.com' }), false);
  assert.equal(isMachineMail({ subject: 'Re: [Ticket #1001] thanks!', fromEmail: 'ada@example.com' }), false);
  // "Auto-Submitted: no" is what a human-sent message says, if it says anything.
  assert.equal(isMachineMail({ subject: 'A question', fromEmail: 'ada@example.com', autoSubmitted: 'no' }), false);
  assert.equal(isMachineMail({}), false);
  assert.equal(isMachineMail({ subject: null, fromEmail: null }), false);
});

test('isMachineMail does not treat a report-shaped word mid-subject as machine mail', () => {
  assert.equal(isMachineMail({ subject: 'I want to report a problem with my order', fromEmail: 'ada@example.com' }), false);
});

// ---------------------------------------------------------------- round trip

// These tie the outbound half (what replyToTicket sends) to the inbound half (what the sync
// matches), which is where a mismatch between the two would actually bite.
test('round trip: our reply comes back and threads on In-Reply-To', () => {
  const ticketNumber = 1001;
  const ourMessageId = 'ticket-abc@bookwrms.store';
  const subject = buildReplySubject(ticketNumber, 'Where is my order');
  const references = buildReferences('<form-1@bookwrms.store>', ourMessageId);

  // What a mail client sends back: Re: on our subject, In-Reply-To our id, References extended.
  const inbound = {
    subject: `Re: ${subject}`,
    inReplyTo: `<${ourMessageId}>`,
    references: `${references} <${ourMessageId}>`,
  };
  const match = matchInboundToThread(inbound, {
    byMessageId: new Map([[ourMessageId, 7]]),
    byTicketNumber: new Map([[ticketNumber, 7]]),
  });
  assert.equal(match.kind, 'header');
  assert.equal(match.kind === 'header' && match.ticketId, 7);
});

test('round trip: a client that strips the threading headers still lands via the subject', () => {
  const subject = buildReplySubject(1001, 'Where is my order');
  const match = matchInboundToThread({ subject: `Re: ${subject}` }, {
    byMessageId: new Map(),
    byTicketNumber: new Map([[1001, 7]]),
  });
  assert.deepEqual(match, { kind: 'subject', ticketId: 7, ticketNumber: 1001 });
});

test('round trip: the token survives a subject that has been Re:d several times', () => {
  const subject = buildReplySubject(1001, 'Where is my order');
  const mangled = `RE: Fwd: Re: ${subject}`;
  assert.equal(parseTicketNumberFromSubject(mangled), 1001);
});

test('round trip: a reply built on our own reply does not duplicate the token', () => {
  const first = buildReplySubject(1001, 'Where is my order');
  const second = buildReplySubject(1001, `Re: ${first}`);
  assert.equal(second, 'Re: [Ticket #1001] Where is my order');
  assert.equal((second.match(/\[Ticket #/g) ?? []).length, 1);
});

// ---------------------------------------------------------------- raw header parsing

test('parseRawHeaders lowercases names and trims values', () => {
  const raw = 'In-Reply-To: <a@x>\r\nReferences: <a@x> <b@x>\r\n';
  assert.deepEqual(parseRawHeaders(raw), { 'in-reply-to': '<a@x>', references: '<a@x> <b@x>' });
});

test('parseRawHeaders unfolds continuation lines', () => {
  const raw = 'References: <a@x>\r\n <b@x>\r\n\t<c@x>\r\n';
  assert.equal(parseRawHeaders(raw).references, '<a@x> <b@x> <c@x>');
  // And the unfolded value is still parseable as a chain.
  assert.deepEqual(parseMessageIdList(parseRawHeaders(raw).references), ['a@x', 'b@x', 'c@x']);
});

test('parseRawHeaders keeps the first of a repeated header', () => {
  const raw = 'Auto-Submitted: auto-replied\r\nAuto-Submitted: no\r\n';
  assert.equal(parseRawHeaders(raw)['auto-submitted'], 'auto-replied');
});

test('parseRawHeaders survives junk and empty input', () => {
  assert.deepEqual(parseRawHeaders(null), {});
  assert.deepEqual(parseRawHeaders(undefined), {});
  assert.deepEqual(parseRawHeaders(''), {});
  assert.deepEqual(parseRawHeaders('no colon here'), {});
  assert.deepEqual(parseRawHeaders(': empty name'), {});
  // A leading continuation line with no header before it is ignored, not crashed on.
  assert.deepEqual(parseRawHeaders(' orphaned continuation\r\nX-A: 1'), { 'x-a': '1' });
});

test('parseRawHeaders handles bare LF as well as CRLF', () => {
  assert.deepEqual(parseRawHeaders('X-A: 1\nX-B: 2'), { 'x-a': '1', 'x-b': '2' });
});

// ---------------------------------------------------------------- small helpers

test('senderDisplayName prefers the name, then the local part', () => {
  assert.equal(senderDisplayName('Ada Lovelace', 'ada@example.com'), 'Ada Lovelace');
  assert.equal(senderDisplayName('', 'ada@example.com'), 'ada');
  assert.equal(senderDisplayName(null, null), 'Unknown sender');
  assert.equal(senderDisplayName('   ', '   '), 'Unknown sender');
  assert.equal(senderDisplayName('x'.repeat(200), 'a@b.c').length, 100);
});

test('cleanInboundBody drops the quoted history', () => {
  const body = 'Thanks, that worked!\n\nOn Tue, 11 Nov 2026 at 09:00, Book Worms Support wrote:\n> the old reply';
  assert.equal(cleanInboundBody(body), 'Thanks, that worked!');
});

test('cleanInboundBody keeps a body with no quote marker', () => {
  assert.equal(cleanInboundBody('Just one line'), 'Just one line');
});

test('cleanInboundBody normalises line endings and caps the length', () => {
  assert.equal(cleanInboundBody('a\r\nb'), 'a\nb');
  assert.equal(cleanInboundBody('x'.repeat(50_000)).length, 20_000);
  assert.equal(cleanInboundBody('a\u0000b'), 'ab');
});

test('cleanInboundBody does not swallow the whole body when the marker is the first line', () => {
  // cut > 0 only, so a body that opens with a quote marker is kept rather than emptied.
  const body = 'On Tue, 11 Nov 2026 at 09:00, someone wrote:\n> quoted';
  assert.notEqual(cleanInboundBody(body), '');
});
