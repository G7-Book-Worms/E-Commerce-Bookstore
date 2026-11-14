// Pulls mail from support@ over IMAP and threads it onto tickets.
//
// Runs in two places: lazily when a staff member opens the inbox (throttled, see COOLDOWN_MS),
// and from a cron through POST /api/staff/tickets/sync. Both call syncSupportMailbox().
//
// Safety properties this file is responsible for:
//   * Two runs at once must not duplicate anything. In one process an in-flight promise is
//     shared; across processes (every Vercel instance has its own memory) the unique index on
//     ticket_messages.message_id is the real guarantee, and appendInboundMessage() treats a
//     duplicate as "already handled" rather than an error.
//   * Message bodies and credentials are never logged. imapflow's own logger is turned off
//     (`logger: false`), because at debug level it prints protocol traffic, and the only things
//     this file prints are counts and error messages.
//   * Missing credentials are not an error. The portal has to render on a laptop with no
//     SUPPORT_EMAIL set, so the sync reports `skipped` and the page carries on.
import 'server-only';
import { ImapFlow } from 'imapflow';
import { logActivity } from '../activity/activity-log';
import {
  appendInboundMessage,
  buildThreadLookup,
  createTicketFromEmail,
} from './ticket-service';
import {
  cleanInboundBody,
  isMachineMail,
  matchInboundToThread,
  normalizeMessageId,
  parseMessageIdList,
  parseRawHeaders,
  parseTicketNumberFromSubject,
  senderDisplayName,
} from './ticket-threading';

const IMAP_HOST = process.env.IMAP_HOST || 'mail.privateemail.com';
const IMAP_PORT = Number(process.env.IMAP_PORT || 993);

/** Opening the inbox syncs at most this often. */
const COOLDOWN_MS = 60_000;
/** Only look at recent mail, so the first run on an old mailbox does not pull years of it. */
const LOOKBACK_DAYS = 14;
/** Hard cap per run, so one sync cannot run long enough to time out a page render. */
const MAX_MESSAGES_PER_RUN = 50;
/** Bodies are truncated well below the `text` column limit. */
const MAX_BODY_BYTES = 64 * 1024;

export interface SyncResult {
  /** 'skipped' means nothing was attempted (no credentials, or inside the cooldown). */
  status: 'ok' | 'skipped' | 'error';
  reason?: string;
  examined: number;
  stored: number;
  newTickets: number;
  threaded: number;
  duplicates: number;
}

const EMPTY: Omit<SyncResult, 'status' | 'reason'> = {
  examined: 0,
  stored: 0,
  newTickets: 0,
  threaded: 0,
  duplicates: 0,
};

// Module-level, so it is per process. The cooldown is a throttle, not a correctness
// mechanism - correctness comes from the message_id dedupe - so an extra run on another
// serverless instance is harmless.
let lastSyncAt = 0;
let inFlight: Promise<SyncResult> | null = null;

function credentials(): { user: string; pass: string } | null {
  const user = process.env.SUPPORT_EMAIL;
  const pass = process.env.SUPPORT_EMAIL_PASSWORD;
  if (!user || !pass) return null;
  return { user, pass };
}

/** Whether IMAP is configured at all, for the UI to explain an empty mailbox honestly. */
export function isMailSyncConfigured(): boolean {
  return credentials() !== null;
}

/**
 * Syncs if the cooldown has elapsed, and never throws. This is what a page render calls: a
 * mail server that is slow or down must not stop the inbox from rendering.
 */
export async function syncOnInboxOpen(): Promise<SyncResult> {
  if (!credentials()) return { status: 'skipped', reason: 'not-configured', ...EMPTY };
  if (Date.now() - lastSyncAt < COOLDOWN_MS) return { status: 'skipped', reason: 'cooldown', ...EMPTY };
  return syncSupportMailbox();
}

/**
 * Connects to support@, threads every new message, and returns what it did.
 *
 * Never throws: every caller is either a page render or a cron, and neither should fail
 * because the mail server did. Concurrent callers in this process share one run.
 */
export async function syncSupportMailbox(): Promise<SyncResult> {
  const creds = credentials();
  if (!creds) return { status: 'skipped', reason: 'not-configured', ...EMPTY };
  if (inFlight) return inFlight;

  inFlight = runSync(creds).finally(() => {
    inFlight = null;
    lastSyncAt = Date.now();
  });
  return inFlight;
}

async function runSync(creds: { user: string; pass: string }): Promise<SyncResult> {
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: creds.user, pass: creds.pass },
    // Off deliberately: at debug level imapflow prints protocol traffic, which would put
    // message bodies (and on some paths the login exchange) into the server log.
    logger: false,
    logRaw: false,
    emitLogs: false,
    disableAutoIdle: true,
    tls: { minVersion: 'TLSv1.2' },
  });

  const counts = { ...EMPTY };

  try {
    await client.connect();
  } catch (err) {
    // Message only: an imapflow error object can carry the command that failed.
    console.error('[mail-sync] could not connect to the support mailbox:', errorMessage(err));
    return { status: 'error', reason: 'connect-failed', ...counts };
  }

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
      const found = await client.search({ since });
      const uids = Array.isArray(found) ? found.slice(-MAX_MESSAGES_PER_RUN) : [];
      if (!uids.length) return { status: 'ok', ...counts };

      for await (const msg of client.fetch(
        uids,
        {
          uid: true,
          envelope: true,
          headers: ['in-reply-to', 'references', 'auto-submitted', 'precedence', 'x-autoreply', 'list-id'],
          bodyParts: ['text'],
        },
        { uid: true }
      )) {
        counts.examined += 1;
        try {
          const outcome = await handleMessage(msg, client.mailbox && typeof client.mailbox === 'object' ? client.mailbox.uidValidity : undefined);
          if (outcome === 'duplicate') counts.duplicates += 1;
          else if (outcome === 'new-ticket') {
            counts.newTickets += 1;
            counts.stored += 1;
          } else if (outcome === 'threaded') {
            counts.threaded += 1;
            counts.stored += 1;
          }
        } catch (err) {
          // One malformed message must not abandon the rest of the run.
          console.error('[mail-sync] skipped a message that could not be processed:', errorMessage(err));
        }
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error('[mail-sync] failed while reading the support mailbox:', errorMessage(err));
    return { status: 'error', reason: 'fetch-failed', ...counts };
  } finally {
    await client.logout().catch(() => {});
  }

  if (counts.stored) {
    await logActivity('system', null, 'mail.synced', {
      examined: counts.examined,
      stored: counts.stored,
      newTickets: counts.newTickets,
      threaded: counts.threaded,
    });
  }
  return { status: 'ok', ...counts };
}

type Outcome = 'new-ticket' | 'threaded' | 'duplicate';

/** Threads one fetched message. Everything it reads from the mail is untrusted text. */
async function handleMessage(
  msg: {
    uid: number;
    envelope?: { subject?: string; messageId?: string; inReplyTo?: string; from?: { name?: string; address?: string }[] };
    headers?: Buffer;
    bodyParts?: Map<string, Buffer>;
  },
  uidValidity?: bigint | number
): Promise<Outcome> {
  const headers = parseRawHeaders(msg.headers?.toString('utf8'));
  const envelope = msg.envelope ?? {};

  const subject = (envelope.subject ?? '').trim().slice(0, 200) || '(no subject)';
  const sender = envelope.from?.[0] ?? {};
  const fromEmail = (sender.address ?? '').trim().toLowerCase().slice(0, 100);
  const fromName = senderDisplayName(sender.name, fromEmail);

  // A message with no Message-ID gets a deterministic one derived from the mailbox position,
  // so the unique index can still dedupe it across runs.
  const messageId =
    normalizeMessageId(envelope.messageId) ?? `imap-${uidValidity ?? 'x'}-${msg.uid}@bookwrms.store`;

  const rawInReplyTo = envelope.inReplyTo ?? headers['in-reply-to'] ?? null;
  const rawReferences = headers['references'] ?? null;
  const inReplyTo = parseMessageIdList(rawInReplyTo)[0] ?? null;

  const bodyPart = msg.bodyParts?.get('text');
  const body = cleanInboundBody(bodyPart ? bodyPart.subarray(0, MAX_BODY_BYTES).toString('utf8') : '');

  const candidates = [...parseMessageIdList(rawInReplyTo), ...parseMessageIdList(rawReferences)];
  const subjectTicketNumber = parseTicketNumberFromSubject(subject);
  const lookup = await buildThreadLookup(candidates, subjectTicketNumber);
  const match = matchInboundToThread({ subject, inReplyTo: rawInReplyTo, references: rawReferences }, lookup);

  if (match.kind === 'header' || match.kind === 'subject') {
    const stored = await appendInboundMessage(match.ticketId, {
      fromEmail: fromEmail || 'unknown@unknown.invalid',
      body: body || '(no text body)',
      messageId,
      inReplyTo,
    });
    return stored ? 'threaded' : 'duplicate';
  }

  // Nothing matched. Before opening a ticket, check we have not already stored this exact
  // message under a thread of its own on an earlier run.
  const seen = await buildThreadLookup([messageId], null);
  if (seen.byMessageId.has(messageId)) return 'duplicate';

  const machine = isMachineMail({
    subject,
    fromEmail,
    autoSubmitted: headers['auto-submitted'] ?? null,
    precedence: headers['precedence'] ?? null,
  });

  const { stored } = await createTicketFromEmail({
    subject,
    fromEmail: fromEmail || 'unknown@unknown.invalid',
    fromName,
    body: body || '(no text body)',
    messageId,
    inReplyTo,
    machine,
  });
  return stored ? 'new-ticket' : 'duplicate';
}

/** Only ever the message, never the error object, which can carry protocol data. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown error';
}
