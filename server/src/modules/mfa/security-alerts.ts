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
import { inBackground } from '../../shared/utils/in-background';
import { emailChangedConfirmationEmail, securityAlertEmail, whenText } from '../email/templates';

export type AlertActor = { kind: 'customer' | 'staff'; id: number; email: string; firstName: string };

const actorType = (kind: AlertActor['kind']) => (kind === 'customer' ? 'customer' : 'admin') as 'customer' | 'admin';
const LOGIN_ACTIONS = { customer: ['auth.login'], staff: ['staff.login'] } as const;

const when = whenText;

function send(actor: AlertActor, action: string, alert: Parameters<typeof securityAlertEmail>[2], details: Record<string, unknown>, ip?: string | null) {
  // After the response: a slow mail server must not hold up a sign-in
  inBackground(async () => {
    try {
      const emailed = await sendEmail(securityAlertEmail(actor.email, actor.firstName, alert, actor.kind));
      let texted: boolean | undefined;
      if (textingAvailable()) {
        const [row] = actor.kind === 'customer'
          ? await db.select({ phone: users.mfaPhone }).from(users).where(eq(users.userId, actor.id))
          : await db.select({ phone: admin.mfaPhone }).from(admin).where(eq(admin.adminId, actor.id));
        if (row?.phone) {
          texted = await sendText(row.phone, textBody(`Security alert: ${alert.title}. Details are in your email. Not you? Change your password now.`));
        }
      }
      await logActivity(actorType(actor.kind), actor.id, action, { ...details, emailed, ...(texted !== undefined ? { texted } : {}) }, ip ?? null);
    } catch (err) {
      console.error('[security-alert] failed', action, err);
    }
  });
  return Promise.resolve();
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
      title: 'New Sign-In to Your Account',
      body: actor.kind === 'staff'
        ? 'Your Book Worms staff account was just signed in to from a network it has not used before.'
        : 'Your Book Worms account was just signed in to from a network it has not used before.',
      facts: [['When', when()], ['IP address', ip]],
    }, { ip }, ip);
  } catch (err) {
    console.error('[security-alert] new sign-in check failed', err);
  }
}

/** Too many wrong passwords: sign-in is locked for 15 minutes. */
export function alertLockout(actor: AlertActor, ip: string | null) {
  return send(actor, 'security.lockout_alert', {
    title: 'Account Locked After Multiple Failed Sign-In Attempts',
    body: 'We detected multiple failed sign-in attempts on your account, so sign-in has been locked for 15 minutes to protect it. If these attempts were yours, wait 15 minutes and try again, or reset your password.',
    facts: [['When', when()], ['IP address', ip ?? 'Unknown']],
  }, {}, ip);
}

const METHOD_LABEL = { none: 'Off', email: 'Code by email', totp: 'Authenticator app', sms: 'Code by text message' } as const;
const METHOD_PHRASE = { none: 'nothing else', email: 'a code sent by email', totp: 'a code from an authenticator app', sms: 'a code sent by text message' } as const;

/** Two-step sign-in was turned on, off, or switched to another method. */
export function alertMfaChanged(actor: AlertActor, from: keyof typeof METHOD_LABEL, to: keyof typeof METHOD_LABEL, ip: string | null) {
  const action = to === 'none' ? 'security.mfa_disabled' : from === 'none' ? 'security.mfa_enabled' : 'security.mfa_method_changed';
  const title = to === 'none' ? 'Two-Step Verification Was Turned Off' : from === 'none' ? 'Two-Step Verification Was Turned On' : 'Your Two-Step Verification Method Was Changed';
  return send(actor, action, {
    title,
    body: to === 'none'
      ? 'Two-step verification was turned off for your account. Signing in now requires only your password.'
      : `Signing in to your account now requires your password and ${METHOD_PHRASE[to]}.`,
    facts: [['When', when()], ['Before', METHOD_LABEL[from]], ['Now', METHOD_LABEL[to]], ['IP address', ip ?? 'Unknown']],
  }, { from, to }, ip);
}

/**
 * The account's email address changed. Sent to the OLD address (the new one may be an
 * attacker's): an emailed sign-in code or a password reset now goes to the new address.
 */
export function alertEmailChanged(actor: AlertActor, newEmail: string, byStaff: boolean, ip: string | null) {
  const masked = newEmail.replace(/^(.).*(@.*)$/, '$1•••$2');
  // The new address hears about it too: it now receives sign-in codes and resets
  inBackground(async () => {
    try { await sendEmail(emailChangedConfirmationEmail(newEmail, actor.firstName, byStaff)); } catch (err) { console.error('[security-alert] new-address email failed', err); }
  });
  return send(actor, 'security.email_changed', {
    title: 'Your Account Email Address Was Changed',
    body: byStaff
      ? 'A member of the Book Worms support team changed the email address on your account. Sign-in codes, password reset links, and order updates now go to the new address.'
      : 'The email address on your account was changed. Sign-in codes, password reset links, and order updates now go to the new address.',
    facts: byStaff ? [['When', when()], ['New address', masked], ['Changed by', 'Book Worms support']] : [['When', when()], ['New address', masked], ['IP address', ip ?? 'Unknown']],
    byStaff,
  }, { byStaff }, ip);
}

/** An administrator ended a sign-in lockout early. */
export function alertUnlockedByStaff(actor: AlertActor) {
  return send(actor, 'security.unlocked_by_staff', {
    title: 'Your Account Was Unlocked by Book Worms Support',
    body: 'A member of the Book Worms support team removed the temporary sign-in lock on your account. You can sign in again now.',
    facts: [['When', when()], ['Changed by', 'Book Worms support']],
    byStaff: true,
  }, {}, null);
}

/** A passkey was added to, or removed from, the account. */
export function alertPasskeyChanged(actor: AlertActor, change: 'added' | 'removed', name: string, ip: string | null) {
  return send(actor, change === 'added' ? 'security.passkey_added' : 'security.passkey_removed', {
    title: change === 'added' ? 'New Passkey Added to Your Account' : 'Passkey Removed from Your Account',
    body: change === 'added'
      ? 'The device below can now sign in to your Book Worms account with a fingerprint, face, or screen lock instead of your password.'
      : 'The device below can no longer sign in to your Book Worms account with a passkey.',
    facts: [['When', when()], ['Passkey', name], ['IP address', ip ?? 'Unknown']],
  }, { name }, ip);
}
