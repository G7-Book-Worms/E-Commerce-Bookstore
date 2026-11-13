'use client';

// Tiny toast notifications: call showToast() from anywhere on the store; <Toaster /> lives in the layouts.
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Toast = { id: number; text: string; href?: string; linkText?: string; tone?: 'ok' | 'error' };

export function showToast(text: string, opts: Omit<Toast, 'id' | 'text'> = {}) {
  window.dispatchEvent(new CustomEvent('bw:toast', { detail: { text, ...opts } }));
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    let next = 1;
    const onToast = (e: Event) => {
      const t = { id: next++, ...(e as CustomEvent).detail } as Toast;
      setToasts((list) => [...list.slice(-2), t]);
      setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), 4000);
    };
    window.addEventListener('bw:toast', onToast);
    return () => window.removeEventListener('bw:toast', onToast);
  }, []);

  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ${
            t.tone === 'error' ? 'bg-red-700 text-white' : 'bg-stone-900 text-white'
          }`}
        >
          <span>{t.text}</span>
          {t.href && <Link href={t.href} className="shrink-0 font-semibold underline underline-offset-2">{t.linkText ?? 'View'}</Link>}
        </div>
      ))}
    </div>
  );
}
