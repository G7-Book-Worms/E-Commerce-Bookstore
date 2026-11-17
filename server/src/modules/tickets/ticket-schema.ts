// Zod schemas for every ticket input. Nothing reaches the service layer unvalidated, including
// the ticket id taken from the URL (see ticketIdParam).
import { z } from 'zod';
import { BadRequestError } from '../../shared/errors/app-error';

export const TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** The footer "Contact Support" form, which opens a ticket. */
export const newTicketSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(100),
  email: z.string().trim().email('Valid email is required').max(100).toLowerCase(),
  subject: z.string().trim().min(3, 'Subject is required').max(200),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(5000),
  // Hidden field real people leave empty; bots fill it in.
  website: z.string().max(0).optional().or(z.literal('')),
});
export type NewTicketInput = z.infer<typeof newTicketSchema>;

/** A staff reply, which is emailed to the customer and appended to the thread. */
export const ticketReplySchema = z.object({
  body: z.string().trim().min(2, 'Write a reply').max(5000),
});

export const ticketStatusSchema = z.object({
  status: z.enum(TICKET_STATUSES),
});

/**
 * Assignment. `assignedTo: null` unassigns. Whether this staff member is allowed to assign to
 * somebody other than themselves is a permission decision, made in the route, not here.
 */
export const ticketAssignSchema = z.object({
  assignedTo: z.number().int().positive().nullable(),
});

export const ticketListQuerySchema = z.object({
  status: z.enum([...TICKET_STATUSES, 'all', 'unresolved']).optional(),
  assignedTo: z.union([z.coerce.number().int().positive(), z.literal('unassigned'), z.literal('any')]).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;

/** Marking an alert read, or all of them. */
export const notificationReadSchema = z.object({
  notificationId: z.number().int().positive().optional(),
  all: z.boolean().optional(),
});

/** A positive integer id from a URL segment. Mirrors idParam() in staff-api.ts. */
const idSchema = z.coerce.number().int().positive().max(2_147_483_647);

export function ticketIdParam(value: string | undefined): number {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new BadRequestError('Invalid ticket id');
  return parsed.data;
}
