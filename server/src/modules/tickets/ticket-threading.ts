// Pure functions for threading inbound email onto support tickets. No database, no network,
// no clock: everything this module needs is passed in, so all of it is unit-tested in
// ticket-threading.test.ts. The database-backed callers live in ticket-service.ts and
// mail-sync.ts.
//
// Matching order (RFC 5322 threading, then our own subject token):
//   1. In-Reply-To     - the message this one directly answers
//   2. References      - walked from the end, because the last entry is the nearest ancestor
//   3. [Ticket #123]   - our token in the subject, for mail clients that drop the headers
//
// A subject token that names a ticket we do not have is deliberately NOT a match: it is
// reported back as `ticketNumber` on a 'none' result so the caller can log it, but it must
// never attach a stranger's mail to a real thread. The number is customer-supplied text.

/** The ticket number we show customers starts here, so #1001 is the first ticket. */
export const TICKET_NUMBER_BASE = 1000;

/** A ticket number has to fit the `int` column and be above the base. */
export const MAX_TICKET_NUMBER = 2_147_483_647;

export interface InboundHeaders {
  subject?: string | null;
  /** Raw In-Reply-To header value, exactly as it arrived. */
  inReplyTo?: string | null;
  /** Raw References header value, exactly as it arrived. */
  references?: string | null;
}

export interface ThreadLookup {
  /** Message-ID (normalised, no angle brackets) -> ticketId, for every message we have sent or stored. */
  byMessageId: ReadonlyMap<string, number>;
  /** Ticket number -> ticketId. */
  byTicketNumber: ReadonlyMap<number, number>;
}

export type ThreadMatch =
  /** Matched on a real RFC 5322 header. */
  | { kind: 'header'; ticketId: number; via: 'in-reply-to' | 'references'; messageId: string }
  /** Matched only on the [Ticket #n] token in the subject. */
  | { kind: 'subject'; ticketId: number; ticketNumber: number }
  /**
   * No thread. `ticketNumber` is set when the subject named a ticket that does not exist,
   * which is worth logging but must not be treated as a match.
   */
  | { kind: 'none'; ticketNumber: number | null };

/**
 * Strips the angle brackets and surrounding whitespace from one Message-ID.
 *
 * Message-IDs are compared verbatim (RFC 5322 makes them case-sensitive and real mail servers
 * preserve them byte for byte), so this only removes the framing, never the case. Returns null
 * for anything that cannot be an id.
 */
export function normalizeMessageId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let id = raw.trim();
  // Tolerate a missing closing bracket, a stray leading one, and repeated brackets.
  while (id.startsWith('<')) id = id.slice(1).trim();
  while (id.endsWith('>')) id = id.slice(0, -1).trim();
  id = id.trim();
  // An id with whitespace inside it is malformed; a bare word with no "@" is not an id either.
  if (!id || /\s/.test(id) || !id.includes('@')) return null;
  // The column is varchar(255); anything longer cannot have come from us.
  if (id.length > 255) return null;
  return id;
}

/**
 * Pulls every Message-ID out of an In-Reply-To or References header, in the order written.
 *
 * Real headers are angle-bracketed and space separated, but broken clients send bare ids,
 * comma separated lists, folded lines and unterminated brackets, so all of those are accepted.
 * Duplicates are removed, keeping the first occurrence.
 */
export function parseMessageIdList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const found: string[] = [];
  const seen = new Set<string>();
  const push = (candidate: string | null) => {
    if (candidate && !seen.has(candidate)) {
      seen.add(candidate);
      found.push(candidate);
    }
  };

  // Angle-bracketed ids first: "<a@b> <c@d>". A "<" with no ">" after it is handled below.
  const bracketed = raw.match(/<[^<>]*>/g);
  if (bracketed) for (const token of bracketed) push(normalizeMessageId(token));

  // Then anything left over once the bracketed pairs are removed, which covers bare ids and
  // an unterminated "<a@b" at the end of a truncated header.
  const leftovers = raw.replace(/<[^<>]*>/g, ' ');
  for (const token of leftovers.split(/[\s,;]+/)) push(normalizeMessageId(token));

  return found;
}

/**
 * Reads our own "[Ticket #123]" token out of a subject line.
 *
 * Returns null when there is no token, when the number is not a plausible ticket number, or
 * when the subject is missing. The subject is untrusted customer text, so the number is
 * range-checked here rather than anywhere further down.
 */
export function parseTicketNumberFromSubject(subject: string | null | undefined): number | null {
  if (!subject) return null;
  // Case-insensitive, tolerant of extra spaces: "[ticket #12]", "[Ticket# 12]", "[Ticket  #12]".
  const match = /\[\s*ticket\s*#\s*(\d{1,12})\s*\]/i.exec(subject);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isInteger(n) || n <= TICKET_NUMBER_BASE || n > MAX_TICKET_NUMBER) return null;
  return n;
}

/** The subject a staff reply goes out with: `Re: [Ticket #123] <original subject>`. */
export function buildReplySubject(ticketNumber: number, subject: string): string {
  // Strip any Re:/Fwd: prefixes and an existing token so a long thread does not grow a
  // "Re: Re: Re: [Ticket #1] [Ticket #1]" subject.
  let base = subject.trim();
  for (;;) {
    const stripped = base
      .replace(/^(re|fw|fwd|aw|sv|antwort)\s*(\[\d+\])?\s*:\s*/i, '')
      .replace(/^\[\s*ticket\s*#\s*\d{1,12}\s*\]\s*/i, '')
      .trim();
    if (stripped === base) break;
    base = stripped;
  }
  return `Re: [Ticket #${ticketNumber}] ${base}`.trim();
}

/**
 * Builds the References header for a reply: the ancestors we already know about, then the
 * message being replied to. Capped so a very long thread cannot produce an unbounded header.
 */
export function buildReferences(parentReferences: string | null | undefined, parentMessageId: string | null | undefined): string | null {
  const chain = parseMessageIdList(parentReferences);
  const parent = normalizeMessageId(parentMessageId);
  if (parent && !chain.includes(parent)) chain.push(parent);
  if (!chain.length) return null;
  // Keep the root (threading clients key off it) and the most recent ancestors.
  const trimmed = chain.length > 12 ? [chain[0], ...chain.slice(-11)] : chain;
  return trimmed.map((id) => `<${id}>`).join(' ');
}

/**
 * Decides which ticket an inbound email belongs to.
 *
 * Headers win over the subject token, and within the headers In-Reply-To wins over References.
 * References is walked from the end because the nearest ancestor is written last, which is what
 * makes a reply to a reply land on the right thread even when we never saw the middle message.
 */
export function matchInboundToThread(headers: InboundHeaders, lookup: ThreadLookup): ThreadMatch {
  for (const id of parseMessageIdList(headers.inReplyTo)) {
    const ticketId = lookup.byMessageId.get(id);
    if (ticketId !== undefined) return { kind: 'header', ticketId, via: 'in-reply-to', messageId: id };
  }

  const references = parseMessageIdList(headers.references);
  for (let i = references.length - 1; i >= 0; i -= 1) {
    const id = references[i];
    const ticketId = lookup.byMessageId.get(id);
    if (ticketId !== undefined) return { kind: 'header', ticketId, via: 'references', messageId: id };
  }

  const ticketNumber = parseTicketNumberFromSubject(headers.subject);
  if (ticketNumber !== null) {
    const ticketId = lookup.byTicketNumber.get(ticketNumber);
    // A token naming a ticket we do not have is reported, not matched.
    if (ticketId !== undefined) return { kind: 'subject', ticketId, ticketNumber };
    return { kind: 'none', ticketNumber };
  }

  return { kind: 'none', ticketNumber: null };
}

/**
 * Whether an inbound email is machine traffic rather than a customer writing in - DMARC and TLS
 * reports, bounces, vacation auto-replies, mailing-list digests. These arrive at support@ and
 * belong in the Mailbox tab, not in the ticket queue.
 *
 * Deliberately conservative: a false negative only means a staff member closes one stray
 * ticket, while a false positive hides a real customer. Everything it looks at is untrusted
 * text, so it only ever reads it, never trusts it.
 */
export function isMachineMail(mail: { subject?: string | null; fromEmail?: string | null; autoSubmitted?: string | null; precedence?: string | null }): boolean {
  // The standard headers a well-behaved automated sender sets (RFC 3834 / RFC 2076).
  const autoSubmitted = (mail.autoSubmitted ?? '').trim().toLowerCase();
  if (autoSubmitted && autoSubmitted !== 'no') return true;
  const precedence = (mail.precedence ?? '').trim().toLowerCase();
  if (precedence === 'bulk' || precedence === 'junk' || precedence === 'list') return true;

  const from = (mail.fromEmail ?? '').trim().toLowerCase();
  const localPart = from.split('@')[0] ?? '';
  if (
    localPart === 'mailer-daemon' ||
    localPart === 'postmaster' ||
    localPart === 'noreply' ||
    localPart === 'no-reply' ||
    localPart === 'donotreply' ||
    localPart === 'do-not-reply' ||
    localPart === 'bounce' ||
    localPart === 'bounces' ||
    localPart.startsWith('dmarc') ||
    localPart.startsWith('noreply-') ||
    localPart.startsWith('no-reply-')
  ) {
    return true;
  }

  const subject = (mail.subject ?? '').trim().toLowerCase();
  if (!subject) return false;
  return (
    subject.startsWith('report domain:') ||          // DMARC aggregate report
    subject.startsWith('report-domain:') ||
    subject.includes('dmarc aggregate report') ||
    subject.includes('dmarc report') ||
    subject.includes('smtp tls report') ||
    subject.includes('tls-rpt') ||
    subject.startsWith('undelivered mail returned') ||
    subject.startsWith('mail delivery failed') ||
    subject.startsWith('delivery status notification') ||
    subject.startsWith('returned mail:') ||
    subject.startsWith('auto-reply') ||
    subject.startsWith('automatic reply') ||
    subject.startsWith('out of office') ||
    subject.startsWith('out-of-office')
  );
}

/**
 * Parses a raw RFC 5322 header block into a lowercase-keyed map.
 *
 * IMAP hands back the requested header lines as raw text, and real headers are folded across
 * continuation lines (a line starting with a space or tab belongs to the one before it). This
 * unfolds them and keeps the first occurrence of each name, which is what the standard says to
 * trust when a header is repeated.
 */
export function parseRawHeaders(raw: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  let currentName: string | null = null;
  let currentValue = '';

  const flush = () => {
    if (currentName && !(currentName in out)) out[currentName] = currentValue.trim();
    currentName = null;
    currentValue = '';
  };

  for (const line of lines) {
    if (/^[ \t]/.test(line)) {
      // Continuation of the previous header.
      if (currentName) currentValue += ` ${line.trim()}`;
      continue;
    }
    flush();
    const colon = line.indexOf(':');
    if (colon <= 0) continue; // blank line, or junk with no name
    currentName = line.slice(0, colon).trim().toLowerCase();
    currentValue = line.slice(colon + 1);
  }
  flush();
  return out;
}

/** The display name to store for an inbound sender when the envelope gives us nothing usable. */
export function senderDisplayName(name: string | null | undefined, email: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (trimmed) return trimmed.slice(0, 100);
  const local = (email ?? '').trim().split('@')[0];
  if (local) return local.slice(0, 100);
  return 'Unknown sender';
}

/**
 * Trims an email body to something a `text` column and a portal page can hold, and strips the
 * quoted history below the usual reply markers so a thread does not repeat itself on screen.
 */
export function cleanInboundBody(body: string, maxLength = 20_000): string {
  const normalised = body.replace(/\r\n/g, '\n').replace(/\u0000/g, '');
  const lines = normalised.split('\n');
  const cut = lines.findIndex((line) =>
    /^-{2,}\s*original message\s*-{2,}$/i.test(line.trim()) ||
    /^_{10,}$/.test(line.trim()) ||
    /^on .{4,80} wrote:$/i.test(line.trim())
  );
  const kept = cut > 0 ? lines.slice(0, cut) : lines;
  return kept.join('\n').trim().slice(0, maxLength);
}
