"use client";

// Cloudflare Turnstile widget (the CAPTCHA). Usage:
//
//   const human = useTurnstile("login");
//   ...
//   {human.widget}
//   if (!(await human.waitUntilReady())) return showError(...);
//   await fetch(url, { headers: { ...human.headers() } });
//   human.reset();            // after every submit: a token works only once
//
// Most visitors never get a puzzle: the box ticks itself and only asks for a click when
// Cloudflare is unsure. Nothing renders when NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set
// (local development); the server then skips the check too.
//
// The server side is server/src/shared/security/turnstile.ts.
import { useCallback, useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
export const TURNSTILE_HEADER = "x-turnstile-token";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;
function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile failed to load")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * `active` = false delays loading Cloudflare's script, e.g. until someone starts typing in the
 * footer contact form, so pages that merely show a form don't load it.
 */
export function useTurnstile(action: string, active = true) {
  // The box is tracked as state, not a ref: a page that first shows a loading skeleton mounts the
  // box later, and the widget has to render then (a ref change wouldn't re-run the effect, which
  // left guest checkout stuck on "the security check is still running").
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  // The same token in a ref, so a submit handler can wait for it (see waitUntilReady)
  const tokenRef = useRef<string | null>(null);
  const setToken = useCallback((t: string | null) => { tokenRef.current = t; setTokenState(t); }, []);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!SITE_KEY || !active || !box) return;
    let cancelled = false;
    loadScript()
      .then((api) => {
        if (cancelled) return;
        widgetId.current = api.render(box, {
          sitekey: SITE_KEY,
          action,
          // Always shown (a small "Verifying… Success!" box) so people can see the form is protected;
          // most visitors still never have to click anything
          size: "flexible",
          theme: "light",
          callback: (t: string) => { setToken(t); setFailed(false); },
          "expired-callback": () => setToken(null),
          "error-callback": () => { setToken(null); setFailed(true); },
        });
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [action, active, box, setToken]);

  const reset = useCallback(() => {
    setToken(null);
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  }, [setToken]);

  const headers = useCallback((): Record<string, string> => (tokenRef.current ? { [TURNSTILE_HEADER]: tokenRef.current } : {}), []);

  /**
   * For submit handlers: resolves true once the check has passed (straight away if it already
   * has, or if no check is configured), false if it hasn't within `ms`. Someone who clicks
   * before the box has ticked just waits a moment instead of getting an error.
   */
  const waitUntilReady = useCallback(async (ms = 15_000): Promise<boolean> => {
    if (!SITE_KEY) return true;
    const until = Date.now() + ms;
    while (!tokenRef.current && Date.now() < until) await new Promise((r) => setTimeout(r, 200));
    return !!tokenRef.current;
  }, []);

  const widget = SITE_KEY ? (
    <div className="flex min-h-[65px] w-full flex-col gap-1">
      <div ref={setBox} className="w-full" />
      {failed && (
        <p role="alert" className="text-xs text-red-700">
          The security check didn&apos;t load. Check your connection or turn off content blockers, then refresh.
        </p>
      )}
    </div>
  ) : null;

  return {
    widget,
    /** Header to send with the request; empty while there's no token yet */
    headers,
    reset,
    waitUntilReady,
    /** True when the form may be sent: no check configured, or the check is solved */
    ready: !SITE_KEY || !!token,
  };
}
