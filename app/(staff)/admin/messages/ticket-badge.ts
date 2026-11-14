// Shared between the inbox list and the thread view. Kept out of page.tsx so neither page
// imports the other's module.
export const TICKET_BADGE: Record<string, { label: string; color: 'amber' | 'gray' | 'green' | 'blue' }> = {
  open: { label: 'Open', color: 'amber' },
  pending: { label: 'Awaiting customer', color: 'blue' },
  resolved: { label: 'Resolved', color: 'green' },
  closed: { label: 'Closed', color: 'gray' },
};
