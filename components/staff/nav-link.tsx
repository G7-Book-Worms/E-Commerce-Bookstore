'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, children, badge = 0 }: { href: string; children: React.ReactNode; badge?: number }) {
  const path = usePathname();
  const active = href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex shrink-0 items-center justify-between gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition ${
        active ? 'bg-green-800 font-semibold text-white' : 'text-green-100 hover:bg-green-900 hover:text-white'
      }`}
    >
      {children}
      {badge > 0 && (
        <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-green-950" aria-label={`${badge} need attention`}>
          {badge}
        </span>
      )}
    </Link>
  );
}
