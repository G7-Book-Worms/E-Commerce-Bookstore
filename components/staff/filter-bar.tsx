// GET form for search + filters on list pages (works without JavaScript).
import type { ReactNode } from 'react';
import { btnSecondary, inputCls } from './ui';

export function FilterBar({ action, q, placeholder, children, hidden = {} }: {
  action: string;
  q?: string;
  placeholder: string;
  children?: ReactNode;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} method="get" className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center" role="search">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label className="sr-only" htmlFor="filter-q">Search</label>
      <input id="filter-q" name="q" defaultValue={q} placeholder={placeholder} className={`${inputCls} sm:max-w-xs`} />
      {children}
      <button className={btnSecondary} type="submit">Apply</button>
    </form>
  );
}
