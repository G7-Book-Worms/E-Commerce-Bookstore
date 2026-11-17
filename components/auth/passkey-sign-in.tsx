'use client';

// "Sign In with a Passkey" button for the customer and staff sign-in pages. The device shows its
// own list of passkeys for this site, so nobody has to type an email first.
import { useEffect, useState } from 'react';
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import { KeyRound } from 'lucide-react';
import { passkeyErrorText } from './passkey-settings';

type Result = { kind: 'customer' | 'staff'; user?: unknown; mustChangePassword?: boolean };

export function PasskeySignIn({ kind, onSuccess, className = '' }: { kind: 'customer' | 'staff'; onSuccess: (data: Result) => void; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setSupported(browserSupportsWebAuthn()), []);
  if (!supported) return null;

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const post = async (body: unknown) => {
        const res = await fetch('/api/passkeys/sign-in', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.success === false) throw new Error(json?.error || 'That passkey didn\'t work. Sign in with your password instead.');
        return json.data;
      };
      const { options } = await post({ step: 'options', kind });
      const response = await startAuthentication({ optionsJSON: options });
      onSuccess(await post({ step: 'verify', kind, response }));
    } catch (err) {
      setError(passkeyErrorText(err));
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-stone-300 bg-white text-sm font-medium text-stone-900 hover:bg-stone-50 disabled:opacity-60"
      >
        <KeyRound className="size-4" aria-hidden />
        {busy ? 'Waiting for your device…' : 'Sign In with a Passkey'}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
