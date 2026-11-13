// "Contact Support" messages (SCRUM-207): saved from the footer form, answered by staff from the
// portal inbox. Replies are emailed from support@bookwrms.store.
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import { admin, contactMessages } from '../../../db/schema';
import { BadRequestError, NotFoundError } from '../../shared/errors/app-error';
import { sendEmail } from '../email/mailer';
import { contactReceivedEmail, contactReplyEmail } from '../email/templates';

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(100),
  email: z.string().trim().email('Valid email is required').max(100).toLowerCase(),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000),
  // Hidden field real people leave empty; bots fill it in
  website: z.string().max(0).optional().or(z.literal('')),
});

export const replySchema = z.object({ reply: z.string().trim().min(2, 'Write a reply').max(5000) });
export const messageStatusSchema = z.object({ status: z.enum(['new', 'read', 'replied', 'archived']) });

export async function createContactMessage(input: z.infer<typeof contactSchema>, userId: number | null) {
  if (input.website) throw new BadRequestError('Invalid inquiry submission');
  const [res] = (await db.insert(contactMessages).values({
    userId,
    name: input.name,
    email: input.email,
    message: input.message,
  })) as unknown as [{ insertId: number }];
  await sendEmail(contactReceivedEmail(input.email, input.name));
  return res.insertId;
}

export async function listMessages(status?: string) {
  const where =
    status === 'open' || !status ? sql`${contactMessages.status} IN ('new', 'read')`
    : status === 'all' ? undefined
    : eq(contactMessages.status, status as 'new');
  return db.select().from(contactMessages).where(where).orderBy(desc(contactMessages.created)).limit(200);
}

export async function messageCounts() {
  const [row] = await db.select({
    unread: sql<number>`SUM(${contactMessages.status} = 'new')`,
    open: sql<number>`SUM(${contactMessages.status} IN ('new', 'read'))`,
  }).from(contactMessages);
  return { unread: Number(row?.unread ?? 0), open: Number(row?.open ?? 0) };
}

/** Opening a message marks it read. */
export async function getMessage(id: number) {
  const [row] = await db
    .select({
      message: contactMessages,
      repliedByName: sql<string | null>`CONCAT(${admin.firstName}, ' ', ${admin.lastName})`,
    })
    .from(contactMessages)
    .leftJoin(admin, eq(admin.adminId, contactMessages.repliedBy))
    .where(eq(contactMessages.messageId, id));
  if (!row) throw new NotFoundError('Message not found');
  if (row.message.status === 'new') {
    await db.update(contactMessages).set({ status: 'read' }).where(eq(contactMessages.messageId, id));
    row.message.status = 'read';
  }
  return row;
}

export async function replyToMessage(staffId: number, id: number, reply: string) {
  const [msg] = await db.select().from(contactMessages).where(eq(contactMessages.messageId, id));
  if (!msg) throw new NotFoundError('Message not found');
  const emailed = await sendEmail(contactReplyEmail(msg.email, msg.name, reply, msg.message));
  await db.update(contactMessages).set({ status: 'replied', reply, repliedBy: staffId, repliedAt: new Date() })
    .where(eq(contactMessages.messageId, id));
  return { emailed, email: msg.email };
}

export async function setMessageStatus(id: number, status: 'new' | 'read' | 'replied' | 'archived') {
  const [msg] = await db.select().from(contactMessages).where(eq(contactMessages.messageId, id));
  if (!msg) throw new NotFoundError('Message not found');
  await db.update(contactMessages).set({ status }).where(eq(contactMessages.messageId, id));
}
