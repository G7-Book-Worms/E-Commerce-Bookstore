'use client';

// "This is a class project" notices (SCRUM-211): a strip on every page, and a big dialog the
// first time someone visits (remembered in this browser once they click "I understand").
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

const KEY = 'bw-demo-notice-v1';

export function DemoStrip() {
  return (
    <div className="bg-amber-300 px-4 py-1.5 text-center text-xs font-medium text-amber-950 sm:text-sm">
      <strong>Class project, not a real store.</strong> Please don&apos;t buy anything: nothing ships, and every payment is a Stripe test payment that&apos;s refunded.
    </div>
  );
}

function readSeen() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false; // storage blocked: show the notice
  }
}
const noSubscribe = () => () => {};

export function DemoDialog() {
  // Server render: treated as seen (no dialog); the browser then reads localStorage
  const seen = useSyncExternalStore(noSubscribe, readSeen, () => true);
  const [dismissed, setDismissed] = useState(false);
  const open = !seen && !dismissed;
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) button.current?.focus();
  }, [open]);

  if (!open) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/60 p-4" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <div role="dialog" aria-modal="true" aria-labelledby="demo-title" aria-describedby="demo-text"
        className="w-full max-w-lg rounded-2xl border-t-8 border-amber-400 bg-white p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Heads up</p>
        <h2 id="demo-title" className="mt-1 font-serif text-2xl font-bold text-stone-900 sm:text-3xl">This is a student project, not a real bookstore</h2>
        <div id="demo-text" className="mt-4 space-y-3 text-sm leading-relaxed text-stone-700">
          <p>Book Worms was built by Group 7 for <strong>CS 3773 Software Engineering at UTSA</strong>. You&apos;re welcome to look around, create an account and try the checkout.</p>
          <p className="rounded-lg bg-amber-50 p-3 text-amber-950">
            <strong>Please don&apos;t buy anything.</strong> The checkout really works, but it runs in Stripe&apos;s <strong>test mode</strong>: no book will ever ship, and every payment is cancelled and refunded automatically. Use the test card <span className="font-mono">4242 4242 4242 4242</span> instead of a real one.
          </p>
          <p>The books, prices and ratings are made up for the demo.</p>
        </div>
        <button ref={button} type="button" onClick={close}
          className="mt-6 h-11 w-full rounded-lg bg-stone-900 text-sm font-semibold text-white hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900">
          I understand, let me look around
        </button>
      </div>
    </div>
  );
}
