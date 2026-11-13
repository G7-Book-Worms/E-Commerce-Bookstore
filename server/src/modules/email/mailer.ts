// Sends email through Namecheap Private Email (SMTP over TLS, port 465). SCRUM-212.
// - no-reply@bookwrms.store sends account and order emails; replies go to support@.
// - support@bookwrms.store sends staff replies to contact messages.
// Without SMTP settings (local dev, tests) emails are printed to the server console instead.
// Sending never throws: a failed email must not break the sign-up or order it belongs to.
import nodemailer, { type Transporter } from 'nodemailer';

type Sender = 'noreply' | 'support';

const transports: Partial<Record<Sender, Transporter>> = {};

function account(sender: Sender) {
  return sender === 'support'
    ? { user: process.env.SUPPORT_EMAIL, pass: process.env.SUPPORT_EMAIL_PASSWORD }
    : { user: process.env.NOREPLY_EMAIL, pass: process.env.NOREPLY_EMAIL_PASSWORD };
}

function transport(sender: Sender): Transporter | null {
  const { user, pass } = account(sender);
  if (!process.env.SMTP_HOST || !user || !pass) return null;
  if (!transports[sender]) {
    const port = Number(process.env.SMTP_PORT || 465);
    transports[sender] = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // TLS from the first byte
      requireTLS: true,
      auth: { user, pass },
      tls: { minVersion: 'TLSv1.2' }, // and the server certificate is verified (default)
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
  }
  return transports[sender]!;
}

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: Sender;
}

export async function sendEmail(email: Email): Promise<boolean> {
  const sender = email.from ?? 'noreply';
  const t = transport(sender);
  const fromAddress = account(sender).user ?? 'no-reply@bookwrms.store';
  if (!t) {
    console.info(`[email:dev] (SMTP not configured) to=${email.to} subject="${email.subject}"\n${email.text}\n`);
    return false;
  }
  try {
    await t.sendMail({
      from: `"Book Worms" <${fromAddress}>`,
      replyTo: process.env.SUPPORT_EMAIL || undefined,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    return true;
  } catch (err) {
    console.error('[email] failed to send', email.subject, 'to', email.to, err instanceof Error ? err.message : err);
    return false;
  }
}
