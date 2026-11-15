'use client';

// Two-step sign-in settings, shared by the customer account page and the staff portal.
// Customers can turn it off; staff can only choose between an emailed code and an
// authenticator app. Every change asks for the current password, and the server emails a
// security alert about it.
import { useCallback, useEffect, useId, useState } from 'react';
import { PasswordInput } from '@/components/ui/password-input';

type Method = 'none' | 'email' | 'totp';
type Setup = { secret: string; qrSvg: string; setupToken: string };

const LABEL: Record<Method, string> = { none: 'Off', email: 'Code by email', totp: 'Authenticator app' };

async function call(endpoint: string, body?: unknown) {
  const res = await fetch(endpoint, {
    method: body ? 'POST' : 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) throw new Error(json?.error || json?.message || 'Something went wrong. Try again.');
  return json.data;
}

export function TwoStepSettings({ endpoint, staff = false }: { endpoint: string; staff?: boolean }) {
  const id = useId();
  const [method, setMethod] = useState<Method | null>(null);
  const [email, setEmail] = useState('');
  const [choice, setChoice] = useState<Method>('email');
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await call(endpoint);
      setMethod(d.method);
      setChoice(d.method);
      setEmail(d.email);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }, [endpoint]);

  useEffect(() => {
    // Initial load of the current setting; setState happens after the await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const options: Method[] = staff ? ['email', 'totp'] : ['none', 'email', 'totp'];

  async function beginTotp() {
    setBusy(true);
    setMsg(null);
    try {
      setSetup(await call(endpoint, { action: 'begin_totp' }));
      setCode('');
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return setMsg({ ok: false, text: 'Enter your current password to save this change.' });
    setBusy(true);
    setMsg(null);
    try {
      const body = choice === 'totp'
        ? { action: 'confirm_totp', setupToken: setup?.setupToken, code: code.replace(/\D/g, ''), password }
        : choice === 'email' ? { action: 'use_email', password } : { action: 'disable', password };
      const d = await call(endpoint, body);
      setMethod(d.method);
      setSetup(null);
      setPassword('');
      setCode('');
      setMsg({ ok: true, text: d.method === 'none' ? 'Two-step sign-in is off.' : `Saved. Signing in now needs ${d.method === 'totp' ? 'a code from your authenticator app' : 'a code we email you'}. We've emailed you a security alert about this change.` });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (method === null) return <p className="text-sm text-stone-500">{msg?.text ?? 'Loading…'}</p>;

  const changing = choice !== method || (choice === 'totp' && !!setup);
  const needsSetup = choice === 'totp' && !setup;

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">
        {staff
          ? 'Staff accounts always need a second step after the password. Choose how you get your code.'
          : 'Add a second step after your password, so someone who learns your password still can\'t get in.'}
        {' '}Currently: <strong>{LABEL[method]}</strong>.
      </p>

      <fieldset className="space-y-2">
        <legend className="sr-only">How to get your sign-in code</legend>
        {options.map((m) => (
          <label key={m} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${choice === m ? 'border-stone-900 bg-stone-50' : 'border-stone-200'}`}>
            <input type="radio" name={`${id}-method`} checked={choice === m} onChange={() => { setChoice(m); setSetup(null); setMsg(null); }} className="mt-0.5" />
            <span>
              <span className="font-medium">{LABEL[m]}</span>
              <span className="block text-xs text-stone-500">
                {m === 'none' && 'Just your password.'}
                {m === 'email' && `A 6-digit code is emailed to ${email} each time you sign in.`}
                {m === 'totp' && 'Google Authenticator, Microsoft Authenticator, 1Password, Authy… Works without signal, and is the most secure option.'}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {needsSetup && choice !== method && (
        <button type="button" onClick={beginTotp} disabled={busy} className="h-10 rounded-md bg-stone-900 px-5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50">
          {busy ? 'Preparing…' : 'Set up an authenticator app'}
        </button>
      )}
      {needsSetup && choice === method && (
        <button type="button" onClick={beginTotp} disabled={busy} className="text-sm text-stone-700 underline underline-offset-4 disabled:opacity-50">
          Move to a new phone or app
        </button>
      )}

      {setup && (
        <div className="space-y-3 rounded-lg border border-stone-200 p-4">
          <p className="text-sm font-medium">1. Scan this with your authenticator app</p>
          {/* SVG generated on our server by the qrcode library from the otpauth:// link */}
          <div className="mx-auto w-44 rounded bg-white p-2" role="img" aria-label="QR code for your authenticator app" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
          <p className="text-xs text-stone-600">
            Can&apos;t scan? Enter this key by hand (time-based):{' '}
            <code className="break-all rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[11px]">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
          </p>
          <label htmlFor={`${id}-code`} className="block text-sm font-medium">2. Enter the 6-digit code it shows</label>
          <input
            id={`${id}-code`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
            className="h-10 w-40 rounded-md border border-stone-300 px-3 text-center font-mono tracking-widest"
          />
        </div>
      )}

      {changing && !needsSetup && (
        <form onSubmit={save} className="space-y-3" noValidate>
          <label htmlFor={`${id}-pw`} className="block text-sm font-medium">Your current password</label>
          <PasswordInput
            id={`${id}-pw`}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
          />
          <button type="submit" disabled={busy} className="h-10 rounded-md bg-stone-900 px-5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50">
            {busy ? 'Saving…' : choice === 'none' ? 'Turn off two-step sign-in' : 'Save'}
          </button>
        </form>
      )}

      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
    </div>
  );
}
