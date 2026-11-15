// server/src/modules/mfa/twilio-messaging.ts
// Plain text messages (security alerts, order updates) from our own Twilio number.
//
// Unlike sign-in codes (twilio-verify.ts), these need a sender number that US carriers have
// approved: a verified toll-free number or a registered 10DLC (A2P) campaign. Until one is
// approved, leave TWILIO_MESSAGING_FROM unset and nothing is texted; email still goes out.
//
// Switched on by TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_MESSAGING_FROM (the approved
// number in +1 form, or a Messaging Service SID starting "MG"). Never throws; never logs the
// token or the message body.

export function textingAvailable(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_MESSAGING_FROM);
}

/** Keeps a text to one SMS segment-ish and always says who it's from. */
export function textBody(message: string, optOut = false): string {
  const body = `Book Worms: ${message.replace(/\s+/g, ' ').trim()}`;
  return optOut ? `${body} Reply STOP to opt out.` : body;
}

export async function sendText(toE164: string, body: string): Promise<boolean> {
  if (!textingAvailable()) return false;
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const from = process.env.TWILIO_MESSAGING_FROM!;
  const form = new URLSearchParams({ To: toE164, Body: body });
  if (from.startsWith('MG')) form.set('MessagingServiceSid', from);
  else form.set('From', from);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { code?: number };
      console.error('[sms] Twilio refused a text', { errorCode: j.code });
    }
    return res.ok;
  } catch (err) {
    console.error('[sms] Twilio unreachable', (err as Error).name);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
