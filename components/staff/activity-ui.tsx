// Shared bits for showing activity log entries (the Activity log page and the dashboard card).
import { TriangleAlert } from 'lucide-react';
import type { ActivityDescription } from '@/lib/activity-categories';
import { Badge } from './ui';

export function CategoryBadge({ d }: { d: Pick<ActivityDescription, 'categoryLabel' | 'color'> }) {
  return <Badge color={d.color}>{d.categoryLabel}</Badge>;
}

/** Marks a failed or blocked security event; the text means it never relies on colour alone. */
export function FailureBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white">
      <TriangleAlert aria-hidden="true" className="size-3" />
      Failed / blocked
    </span>
  );
}

/** The friendly label, with the raw action name underneath for anyone who needs to search for it. */
export function ActionText({ d, action }: { d: Pick<ActivityDescription, 'label' | 'failure'>; action: string }) {
  return (
    <>
      <span className={`font-medium ${d.failure ? 'text-red-900' : 'text-stone-900'}`}>{d.label}</span>
      <code className="mt-0.5 block font-mono text-[11px] text-stone-400">{action}</code>
    </>
  );
}
