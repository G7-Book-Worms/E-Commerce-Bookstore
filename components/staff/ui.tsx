// Small building blocks for the staff portal pages (server-component friendly).
import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-serif text-2xl font-bold text-stone-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, actions, className = '' }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-stone-200 bg-white shadow-2xs ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, href, tone = 'default' }: { label: string; value: ReactNode; hint?: string; href?: string; tone?: 'default' | 'warn' | 'bad' }) {
  const ring = tone === 'bad' ? 'border-red-200 bg-red-50' : tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-white';
  const body = (
    <div className={`h-full rounded-lg border p-4 shadow-2xs ${ring} ${href ? 'transition hover:border-stone-400' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-stone-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full focus-visible:outline-2 focus-visible:outline-green-800 rounded-lg">{body}</Link> : body;
}

const BADGE: Record<string, string> = {
  green: 'bg-green-100 text-green-900',
  amber: 'bg-amber-100 text-amber-900',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-sky-100 text-sky-900',
  gray: 'bg-stone-100 text-stone-700',
  purple: 'bg-violet-100 text-violet-900',
};
export function Badge({ children, color = 'gray' }: { children: ReactNode; color?: keyof typeof BADGE }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${BADGE[color]}`}>{children}</span>;
}

export const ORDER_STATUS_BADGE: Record<string, { label: string; color: keyof typeof BADGE }> = {
  pending: { label: 'Processing', color: 'amber' },
  transit: { label: 'Shipped', color: 'blue' },
  arrived: { label: 'Delivered', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'red' },
};

/** Column header link that sorts the table (keeps the other query params). */
export function SortLink({ label, column, params, basePath }: { label: string; column: string; params: Record<string, string | undefined>; basePath: string }) {
  const active = (params.sort ?? '') === column;
  const dir = active && params.dir !== 'asc' ? 'asc' : 'desc';
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && k !== 'sort' && k !== 'dir' && k !== 'page') qs.set(k, v);
  qs.set('sort', column);
  qs.set('dir', dir);
  return (
    <Link href={`${basePath}?${qs}`} className="inline-flex items-center gap-1 hover:text-stone-900" aria-label={`Sort by ${label}`}>
      {label}
      <span aria-hidden="true" className={active ? 'text-stone-900' : 'text-stone-300'}>
        {active ? (params.dir === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </Link>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-2xs">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}
export const th = 'px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-stone-500 bg-stone-50 border-b border-stone-200';
export const td = 'px-3 py-2.5 border-b border-stone-100 align-top';

export function EmptyState({ title, text, image = '/images/empty-states/tabby-kitten-glancing-back.webp' }: { title: string; text?: string; image?: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-stone-300 bg-white px-4 py-10 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" width={160} height={120} className="mb-3 h-28 w-auto" />
      <p className="font-medium text-stone-800">{title}</p>
      {text && <p className="mt-1 text-sm text-stone-500">{text}</p>}
    </div>
  );
}

export function Pager({ page, total, pageSize, params, basePath }: { page: number; total: number; pageSize: number; params: Record<string, string | undefined>; basePath: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== 'page') qs.set(k, v);
    qs.set('page', String(p));
    return `${basePath}?${qs}`;
  };
  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pages">
      <span className="text-stone-500">Page {page} of {pages} · {total} total</span>
      <div className="flex gap-2">
        {page > 1 && <Link className="rounded border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-50" href={href(page - 1)}>Previous</Link>}
        {page < pages && <Link className="rounded border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-50" href={href(page + 1)}>Next</Link>}
      </div>
    </nav>
  );
}

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export const dateTime = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }) : '—';
export const dateOnly = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' }) : '—';

export const inputCls = 'h-9 w-full rounded-md border border-stone-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-800 disabled:opacity-50';
export const btnPrimary = 'inline-flex h-9 items-center justify-center rounded-md bg-green-900 px-4 text-sm font-medium text-white hover:bg-green-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-800 disabled:opacity-50';
export const btnSecondary = 'inline-flex h-9 items-center justify-center rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-800 disabled:opacity-50';
export const btnDanger = 'inline-flex h-9 items-center justify-center rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50';
