// The edition of a cart or order line (Hardcover / Paperback) as a small pill, so two lines of
// the same book in different editions are easy to tell apart. Used wherever lines are listed:
// the cart, checkout's "Review items", the order confirmation and the account's order history.
import { cn } from '@/lib/utils';

const STYLES = {
  // Solid and dark for the hardcover, light and outlined for the paperback: they differ in
  // shape and contrast as well as colour, so they don't rely on colour alone.
  hardcover: { label: 'Hardcover', cls: 'border-stone-800 bg-stone-800 text-white' },
  paperback: { label: 'Paperback', cls: 'border-amber-300 bg-amber-50 text-amber-900' },
} as const;

export function formatLabel(format: string | null | undefined): string {
  const key = (format ?? '').toLowerCase();
  if (key === 'hardcover' || key === 'paperback') return STYLES[key].label;
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : '';
}

export function FormatBadge({ format, className }: { format: string | null | undefined; className?: string }) {
  const key = (format ?? '').toLowerCase();
  if (!key) return null;
  const style = key === 'hardcover' || key === 'paperback' ? STYLES[key].cls : 'border-stone-300 bg-stone-100 text-stone-700';
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[11px] font-bold uppercase leading-none tracking-wide whitespace-nowrap',
        style,
        className,
      )}
    >
      {formatLabel(key)}
    </span>
  );
}
