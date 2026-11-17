// Turns an activity entry's JSON details into readable "label: value" pairs, with links to the order,
// customer, book or ticket they mention. Pure; the page only renders what this returns.

export type DetailPart = { text: string; href?: string };
export type DetailItem = { key: string; label: string; parts: DetailPart[] };

const LABELS: Record<string, string> = {
  orderId: 'Order',
  userId: 'Customer',
  bookId: 'Book',
  bookFormatId: 'Book format',
  ticketId: 'Ticket',
  number: 'Ticket number',
  ticketNumber: 'Ticket number',
  messageId: 'Message',
  notificationId: 'Alert',
  targetId: 'Staff account',
  totalCents: 'Total',
  priceCents: 'Price',
  salePriceCents: 'Sale price',
  quantityChange: 'Change',
  stockAfter: 'Stock now',
  lowStockThreshold: 'Low-stock level',
  rememberMe: 'Stay signed in',
  emailed: 'Email sent',
  emailSent: 'Email sent',
  previousEmail: 'Email before deletion',
  previousCode: 'Old code',
  code: 'Code',
  kind: 'Type',
  value: 'Amount',
  isbn: 'ISBN',
  addedFormat: 'Format added',
  assignedTo: 'Assigned to (staff #)',
  before: 'Before',
  after: 'After',
  from: 'From',
  to: 'To',
  status: 'Status',
  changed: 'Fields changed',
  requested: 'Requested',
  applied: 'Done',
  skipped: 'Skipped',
  examined: 'Emails checked',
  stored: 'Emails saved',
  newTickets: 'New tickets',
  threaded: 'Added to existing tickets',
  items: 'Books',
  employeeId: 'Employee ID',
  role: 'Role',
  note: 'Note',
  orderIds: 'Orders',
  userIds: 'Customers',
};

// The acting staff member is already shown in the "Who" column.
const HIDDEN = new Set(['actorId', 'password', 'passwordHash', 'token']);
const MONEY = new Set(['totalCents', 'priceCents', 'salePriceCents', 'subtotalCents', 'taxCents', 'discountCents', 'amountCents']);

const idOf = (v: unknown): number | null => {
  const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
};

/** "lowStockThreshold" -> "Low stock threshold". */
export function humanizeKey(key: string): string {
  const s = key.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim().toLowerCase();
  return s ? s[0].toUpperCase() + s.slice(1) : key;
}

function linkFor(key: string, value: unknown, action: string): DetailPart | null {
  const id = idOf(value);
  if (id === null) return null;
  switch (key) {
    case 'orderId': case 'orderIds': return { text: `#${id}`, href: `/admin/orders/${id}` };
    case 'bookId': return { text: `#${id}`, href: `/admin/books/${id}` };
    case 'ticketId': return { text: `#${id}`, href: `/admin/messages/${id}` };
    case 'userId': case 'userIds': return { text: `#${id}`, href: `/admin/customers/${id}` };
    // Bulk customer summaries list the affected customer ids.
    case 'applied': case 'skipped':
      return action.startsWith('customer.') ? { text: `#${id}`, href: `/admin/customers/${id}` } : null;
    default: return null;
  }
}

function plain(key: string, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && MONEY.has(key)) return `$${(value / 100).toFixed(2)}`;
  if (typeof value === 'number' && key === 'quantityChange') return value > 0 ? `+${value}` : String(value);
  if (typeof value === 'number' && (key === 'targetId' || key === 'messageId' || key === 'notificationId' || key === 'bookFormatId')) return `#${value}`;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function lowStockItem(v: unknown): DetailPart {
  if (!v || typeof v !== 'object') return { text: plain('', v) };
  const i = v as { title?: unknown; format?: unknown; stock?: unknown; threshold?: unknown; bookId?: unknown };
  const title = typeof i.title === 'string' ? i.title : 'Book';
  const format = typeof i.format === 'string' && i.format ? ` (${i.format})` : '';
  const stock = typeof i.stock === 'number' ? (i.stock === 0 ? 'sold out' : `${i.stock} left`) : '';
  const threshold = typeof i.threshold === 'number' ? `, alert at ${i.threshold}` : '';
  const id = idOf(i.bookId);
  return { text: `${title}${format}${stock ? `: ${stock}` : ''}${threshold}`, href: id ? `/admin/books/${id}` : undefined };
}

export function describeDetails(details: unknown, action = ''): DetailItem[] {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return [];
  const out: DetailItem[] = [];
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (HIDDEN.has(key) || value === null || value === undefined || value === '') continue;
    let parts: DetailPart[];
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      parts = key === 'items'
        ? value.map(lowStockItem)
        : value.map((v) => linkFor(key, v, action) ?? { text: plain(key, v) });
    } else {
      parts = [linkFor(key, value, action) ?? { text: plain(key, value) }];
    }
    out.push({ key, label: LABELS[key] ?? humanizeKey(key), parts });
  }
  return out;
}
