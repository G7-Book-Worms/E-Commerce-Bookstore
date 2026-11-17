// server/src/modules/mfa/twilio-verify.ts
// Sign-in codes by text message through Twilio Verify.
//
// Verify sends the code from Twilio's own pre-approved numbers and templates and checks it on
// Twilio's side, so we never see or store the code, and we don't need our own registered
// texting number. On a Twilio free trial it can text up to five phone numbers verified in the
// Twilio console, which is enough for a class demo.
//
// It is switched on by setting all three of TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and
// TWILIO_VERIFY_SERVICE_SID. Without them the text-message option simply isn't offered.
// Plain fetch to the REST API (no SDK); the auth token is never logged.

export function smsAvailable(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID);
}

/**
 * A phone number in E.164 form (+12105550100), or null if it can't be one.
 * Ten digits (optionally with a leading 1) are taken as a US number; anything else needs a +.
 */
export function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return /^[2-9]\d{2}[2-9]/.test(digits) ? `+1${digits}` : null;
  if (digits.length === 11 && digits.startsWith('1')) return /^1[2-9]\d{2}[2-9]/.test(digits) ? `+${digits}` : null;
  return null;
}

/** "•••-•••-0100": enough to recognise the phone without printing the number. */
export function maskPhone(e164: string): string {
  return `•••-•••-${e164.slice(-4)}`;
}

async function twilio(path: string, form: Record<string, string>) {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const service = process.env.TWILIO_VERIFY_SERVICE_SID!;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(service)}/${path}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => ({}))) as { status?: string; code?: number; message?: string };
    return { ok: res.ok, status: json.status, errorCode: json.code };
  } finally {
    clearTimeout(timer);
  }
}

/** Texts a code. Returns false (never throws) if Twilio refused or couldn't be reached. */
export async function sendSmsCode(e164: string): Promise<boolean> {
  if (!smsAvailable()) return false;
  try {
    const r = await twilio('Verifications', { To: e164, Channel: 'sms' });
    if (!r.ok) console.error('[sms] Twilio refused to send a code', { errorCode: r.errorCode });
    return r.ok;
  } catch (err) {
    console.error('[sms] Twilio unreachable', (err as Error).name);
    return false;
  }
}

/** True only when Twilio says this is the right, unexpired code for this number. */
export async function checkSmsCode(e164: string, code: string): Promise<boolean> {
  const digits = code.replace(/\D/g, '');
  if (!smsAvailable() || !/^\d{4,10}$/.test(digits)) return false;
  try {
    const r = await twilio('VerificationCheck', { To: e164, Code: digits });
    return r.ok && r.status === 'approved';
  } catch {
    return false;
  }
}
