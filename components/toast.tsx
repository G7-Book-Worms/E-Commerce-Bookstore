'use client';

// Tiny toast notifications: call showToast() from anywhere on the store; <Toaster /> lives in the layouts.
//
// A toast with a `key` is never stacked: showing the same key again while it is on screen bumps
// the one already there instead. Each bump replaces its text, restarts its timer and shakes it,
// harder the more often it is repeated (capped), with the text briefly growing. That is how
// "you can't add any more" answers someone tapping + over and over. People who prefer reduced
// motion get a colour pulse instead of the shake (see globals.css).
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type Tone = 'ok' | 'error' | 'warn';
type ToastInput = { text: string; href?: string; linkText?: string; tone?: Tone; key?: string };
type Toast = ToastInput & { id: number; bumps: number };

export function showToast(text: string, opts: Omit<ToastInput, 'text'> = {}) {
  window.dispatchEvent(new CustomEvent('bw:toast', { detail: { text, ...opts } }));
}

const VISIBLE_MS = 4000;
const MAX_ON_SCREEN = 3;

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // The same list, readable from the event handler, so deciding "bump or new" and starting
  // timers happens outside React's state updater (which may run more than once)
  const current = useRef<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    let next = 1;
    const map = timers.current;
    const update = (list: Toast[]) => {
      current.current = list;
      setToasts(list);
    };
    const expire = (id: number) => {
      clearTimeout(map.get(id));
      map.set(id, setTimeout(() => {
        map.delete(id);
        update(current.current.filter((x) => x.id !== id));
      }, VISIBLE_MS));
    };
    const onToast = (e: Event) => {
      const d = (e as CustomEvent).detail as ToastInput;
      const same = d.key ? current.current.find((x) => x.key === d.key) : undefined;
      if (same) {
        expire(same.id);
        // The new message replaces the old one entirely (no stale link left behind)
        update(current.current.map((x) => (x.id === same.id
          ? { id: x.id, key: x.key, text: d.text, href: d.href, linkText: d.linkText, tone: d.tone, bumps: x.bumps + 1 }
          : x)));
        return;
      }
      const t: Toast = { ...d, id: next++, bumps: 0 };
      const kept = current.current.slice(-(MAX_ON_SCREEN - 1));
      for (const old of current.current) {
        if (!kept.includes(old)) {
          clearTimeout(map.get(old.id));
          map.delete(old.id);
        }
      }
      expire(t.id);
      update([...kept, t]);
    };
    window.addEventListener('bw:toast', onToast);
    return () => {
      window.removeEventListener('bw:toast', onToast);
      map.forEach(clearTimeout);
      map.clear();
    };
  }, []);

  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
    </div>
  );
}

/** One toast. Kept mounted across bumps (so focus on its link isn't lost); the shake restarts in place. */
function ToastItem({ toast: t }: { toast: Toast }) {
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!t.bumps) return;
    // Restart the CSS animations: drop the class, force a reflow, add it back
    for (const [el, cls] of [[box.current, 'bw-toast-shake'], [text.current, 'bw-toast-grow']] as const) {
      if (!el) continue;
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
    }
  }, [t.bumps]);

  // 1 to 4: how hard the box shakes on this bump
  const level = Math.min(4, t.bumps);
  return (
    <div
      ref={box}
      data-toast-key={t.key}
      data-bumps={t.bumps}
      style={{ ['--shake' as string]: `${3 + level * 3}px` } as React.CSSProperties}
      className={`bw-toast-in pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ${
        t.tone === 'error'
          ? 'bg-red-700 text-white'
          : t.tone === 'warn'
            ? 'border border-red-300 border-l-4 border-l-red-600 bg-white text-red-800'
            : 'bg-stone-900 text-white'
      }`}
    >
      <span ref={text} className={`inline-block origin-left ${t.tone === 'warn' ? 'font-medium' : ''}`}>{t.text}</span>
      {t.href && <Link href={t.href} className="shrink-0 font-semibold underline underline-offset-2">{t.linkText ?? 'View'}</Link>}
    </div>
  );
}
