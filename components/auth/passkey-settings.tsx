'use client';

// Passkeys in account settings (customers: Account → Security; staff: Password & sign-in).
// Lists this account's passkeys, adds one for the device in use, and removes one. Adding and
// removing ask for the account password; the server checks it and emails a security alert.
import { useCallback, useEffect, useState } from 'react';
import { browserSupportsWebAuthn, startRegistration, WebAuthnError } from '@simplewebauthn/browser';
import { KeyRound, Trash2 } from 'lucide-react';
import { PasswordInput } from '@/components/ui/password-input';

type Passkey = { passkeyId: number; name: string; created: string; lastUsedAt: string | null; backedUp: boolean };

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) throw new Error(json?.error || json?.message || 'Something went wrong. Try again.');
  return json.data;
}

/** Turns the browser's WebAuthn errors into something a person can act on. */
export function passkeyErrorText(err: unknown): string {
  if (err instanceof WebAuthnError) {
    if (err.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') return 'This device already has a passkey for your account.';
    if (err.code === 'ERROR_CEREMONY_ABORTED') return 'Cancelled.';
  }
  const name = (err as Error)?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') return 'Cancelled, or the time ran out. Try again when you\'re ready.';
  if (name === 'InvalidStateError') return 'This device already has a passkey for your account.';
  if (name === 'SecurityError') return 'Passkeys only work on the real site address (https).';
  return (err as Error)?.message || 'Something went wrong. Try again.';
}

const dateText = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null);

export function PasskeySettings({ endpoint }: { endpoint: '/api/passkeys' | '/api/staff/passkeys' }) {
  const [list, setList] = useState<Passkey[] | null>(null);
  const [supported, setSupported] = useState(true);
  const [mode, setMode] = useState<{ kind: 'add' } | { kind: 'remove'; passkey: Passkey } | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setList((await call(endpoint, 'GET')).passkeys);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      setList([]);
    }
  }, [endpoint]);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
    void load();
  }, [load]);

  function close() {
    setMode(null);
    setPassword('');
    setName('');
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return setMsg({ ok: false, text: 'Enter your password.' });
    setBusy(true);
    setMsg(null);
    try {
      const { options } = await call(endpoint, 'POST', { step: 'options' });
      const response = await startRegistration({ optionsJSON: options });
      const r = await call(endpoint, 'POST', { step: 'add', response, name: name.trim() || undefined, password });
      setMsg({ ok: true, text: `Passkey added (${r.name}). Next time, choose "Sign In with a Passkey".` });
      close();
      await load();
    } catch (err) {
      setMsg({ ok: false, text: passkeyErrorText(err) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (mode?.kind !== 'remove') return;
    if (!password) return setMsg({ ok: false, text: 'Enter your password.' });
    setBusy(true);
    setMsg(null);
    try {
      await call(`${endpoint}/${mode.passkey.passkeyId}`, 'DELETE', { password });
      setMsg({ ok: true, text: `Removed "${mode.passkey.name}". It can't be used to sign in any more.` });
      close();
      await load();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (list === null) return <p className="text-sm text-stone-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">
        Sign in with your fingerprint, face or screen lock instead of a password. A passkey can&apos;t be
        guessed, leaked or phished, and it skips the sign-in code.
      </p>

      {list.length > 0 ? (
        <ul className="divide-y rounded-lg border border-stone-200">
          {list.map((p) => (
            <li key={p.passkeyId} className="flex items-center gap-3 p-3 text-sm">
              <KeyRound className="size-4 shrink-0 text-stone-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-stone-900">{p.name}</p>
                <p className="text-xs text-stone-500">
                  Added {dateText(p.created)}
                  {p.lastUsedAt ? ` · last used ${dateText(p.lastUsedAt)}` : ' · not used yet'}
                  {p.backedUp ? ' · synced' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setMode({ kind: 'remove', passkey: p }); setMsg(null); }}
                className="inline-flex size-9 items-center justify-center rounded-md text-stone-500 hover:bg-red-50 hover:text-red-700"
                aria-label={`Remove passkey ${p.name}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-stone-300 p-3 text-sm text-stone-500">No passkeys yet.</p>
      )}

      {mode === null && (
        supported ? (
          <button
            type="button"
            onClick={() => { setMode({ kind: 'add' }); setMsg(null); }}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-stone-900 px-4 text-sm font-medium text-stone-50 hover:bg-stone-800"
          >
            <KeyRound className="size-4" aria-hidden /> Add a passkey for this device
          </button>
        ) : (
          <p className="text-sm text-stone-500">This browser doesn&apos;t support passkeys.</p>
        )
      )}

      {mode?.kind === 'add' && (
        <form onSubmit={add} className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Name (optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} placeholder="e.g. My iPhone" className="h-10 w-full rounded-md border border-stone-300 bg-white px-3" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Your password</span>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus className="h-10 w-full rounded-md border border-stone-300 bg-white px-3" />
          </label>
          <p className="text-xs text-stone-500">Next, your device asks for your fingerprint, face or screen lock.</p>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="h-10 rounded-md bg-stone-900 px-4 text-sm font-medium text-stone-50 hover:bg-stone-800 disabled:opacity-60">
              {busy ? 'Waiting for your device…' : 'Continue'}
            </button>
            <button type="button" onClick={close} className="h-10 rounded-md border border-stone-300 px-4 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {mode?.kind === 'remove' && (
        <form onSubmit={remove} className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-900">Remove <strong>{mode.passkey.name}</strong>? That device will need your password again.</p>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Your password</span>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus className="h-10 w-full rounded-md border border-stone-300 bg-white px-3" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="h-10 rounded-md bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60">
              {busy ? 'Removing…' : 'Remove passkey'}
            </button>
            <button type="button" onClick={close} className="h-10 rounded-md border border-stone-300 bg-white px-4 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
    </div>
  );
}
