'use client';

// A link that still does something when you're already on its page: people click a link to the
// page they're on to start it over, so it reloads (or, for a "#section" link, scrolls back to that
// section). Next's <Link> otherwise does nothing in that case.
import Link from 'next/link';
import type { ComponentProps } from 'react';

export function SamePageLink({ href, onClick, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  return (
    <Link
      href={href}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        const [path, hash] = href.split('#');
        // Read at click time (not usePathname), so pages that render this can still be prerendered
        if (path !== window.location.pathname) return;
        e.preventDefault();
        if (hash) {
          document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          history.replaceState(null, '', `#${hash}`);
        } else {
          window.location.reload();
        }
      }}
    />
  );
}
