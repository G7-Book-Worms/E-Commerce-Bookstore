// server/src/modules/mfa/security-alerts.ts
// Emails an account's owner when something security-relevant happens to it (and texts their
// verified phone too, once an approved texting number is set up: see twilio-messaging.ts), and records every
// alert in the activity log (category Security) so staff can see what was sent and why.
//
// Alerts never throw: a mail server problem must not block a sign-in.
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../../db';
import { activityLog, admin, users } from '../../../db/schema';
import { sendText, textBody, textingAvailable } from './twilio-messaging';
import { logActivity } from '../activity/activity-log';
import { sendEmail } from '../email/mailer';
import { securityAlertEmail } from '../email/templates';

export type AlertActor = { kind: 'customer' | 'staff'; id: number; email: string; firstName: string };

const actorType = (kind: AlertActor['kind']) => (kind === 'customer' ? 'customer' : 'admin') as 'customer' | 'admin';
const LOGIN_ACTIONS = { customer: ['auth.login'], staff: ['staff.login'] } as const;

function when(d = new Date()) {
  return `${d.toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' })} (Central)`;
}

async function send(actor: AlertActor, action: string, alert: Parameters<typeof securityAlertEmail>[2], details: Record<string, unknown>, ip?: string | null) {
  try {
    const emailed = await sendEmail(securityAlertEmail(actor.email, actor.firstName, alert, actor.kind));
    let texted: boolean | undefined;
    if (textingAvailable()) {
      const [row] = actor.kind === 'customer'
        ? await db.select({ phone: users.mfaPhone }).from(users).where(eq(users.userId, actor.id))
        : await db.select({ phone: admin.mfaPhone }).from(admin).where(eq(admin.adminId, actor.id));
      if (row?.phone) {
        texted = await sendText(row.phone, textBody(`security alert: ${alert.headline.toLowerCase()}. Details are in your email. Not you? Change your password now.`));
      }
    }
    await logActivity(actorType(actor.kind), actor.id, action, { ...details, emailed, ...(texted !== undefined ? { texted } : {}) }, ip ?? null);
  } catch (err) {
    console.error('[security-alert] failed', action, err);
  }
}

/**
 * Call just before logging a successful sign-in. Alerts when the account has signed in before
 * but never from this IP address. The first sign-in ever (straight after registering) is quiet.
 */
export async function alertIfNewSignIn(actor: AlertActor, ip: string | null) {
  if (!ip) return;
  try {
    const actions = [...LOGIN_ACTIONS[actor.kind]];
    const base = and(eq(activityLog.actorType, actorType(actor.kind)), eq(activityLog.actorId, actor.id), inArray(activityLog.action, actions));
    const [[before], [fromHere]] = await Promise.all([
      db.select({ n: sql<number>`COUNT(*)` }).from(activityLog).where(base),
      db.select({ n: sql<number>`COUNT(*)` }).from(activityLog).where(and(base, eq(activityLog.ip, ip))),
    ]);
    if (Number(before?.n ?? 0) === 0 || Number(fromHere?.n ?? 0) > 0) return;
    await send(actor, 'security.new_sign_in_alert', {
      subject: 'new sign-in',
      headline: 'New sign-in to your account',
      body: actor.kind === 'staff'
        ? 'Your Book Worms staff account was just signed in to from a network it has not been used from before.'
        : 'Your Book Worms account was just signed in to from a network it has not been used from before.',
      facts: [['When', when()], ['IP address', ip]],
    }, { ip }, ip);
  } catch (err) {
    console.error('[security-alert] new sign-in check failed', err);
  }
}

/** Too many wrong passwords: sign-in is paused for 15 minutes. */
export function alertLockout(actor: AlertActor, ip: string | null) {
  return send(actor, 'security.lockout_alert', {
    subject: 'sign-in paused after wrong passwords',
    headline: 'We paused sign-in to your account',
    body: 'Someone typed the wrong password for your account several times, so sign-in is paused for 15 minutes. If that was you, wait and try again, or reset your password.',
    facts: [['When', when()], ['IP address', ip ?? 'unknown']],
  }, {}, ip);
}

const METHOD_LABEL = { none: 'off', email: 'a code by email', totp: 'an authenticator app', sms: 'a code by text message' } as const;

/** Two-step sign-in was turned on, off, or switched to another method. */
export function alertMfaChanged(actor: AlertActor, from: keyof typeof METHOD_LABEL, to: keyof typeof METHOD_LABEL, ip: string | null) {
  const action = to === 'none' ? 'security.mfa_disabled' : from === 'none' ? 'security.mfa_enabled' : 'security.mfa_method_changed';
  const headline = to === 'none' ? 'Two-step sign-in was turned off' : from === 'none' ? 'Two-step sign-in is on' : 'Your two-step sign-in method changed';
  return send(actor, action, {
    subject: headline.toLowerCase(),
    headline,
    body: to === 'none'
      ? 'Signing in to your account now needs only your password.'
      : `Signing in to your account now also needs ${METHOD_LABEL[to]}.`,
    facts: [['When', when()], ['Before', METHOD_LABEL[from]], ['Now', METHOD_LABEL[to]], ['IP address', ip ?? 'unknown']],
  }, { from, to }, ip);
}
