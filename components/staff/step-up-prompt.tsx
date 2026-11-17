'use client';

// Asks the signed-in staff member for their own password before a destructive action.
//
// This box is a courtesy, not the control: the server checks the password again on every one of
// these requests (server/src/modules/staff/step-up.ts) and refuses the action if it is wrong or
// missing, so skipping the box changes nothing. There is no Show/Hide button - this is somebody
// typing their own password in a shared back office.
import { useState } from 'react';
import { btnDanger, btnSecondary, inputCls } from './ui';

export interface StepUpRequest {
  /** What will happen, in plain words, e.g. "Delete Ada Lovelace's account". */
  title: string;
  /** The consequences, shown above the password box. */
  description: string;
  confirmLabel: string;
  run: (actorPassword: string) => Promise<{ ok: boolean; message: string }>;
}

export function StepUpPrompt({ request, onClose }: { request: StepUpRequest | null; onClose: (done: boolean) => void }) {
  // The dialog only exists while there is something to confirm, so the typed password is dropped
  // when it closes - there is nothing to reset and nothing left holding a password.
  if (!request) return null;
  return <Dialog request={request} onClose={onClose} />;
}

function Dialog({ request, onClose }: { request: StepUpRequest; onClose: (done: boolean) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      setError('Enter your password to continue');
      return;
    }
    setBusy(true);
    const res = await request.run(password);
    setPassword('');
    setBusy(false);
    if (res.ok) {
      onClose(true);
      return;
    }
    setError(res.message);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="step-up-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !busy) onClose(false);
      }}
    >
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-5 shadow-lg">
        <h2 id="step-up-title" className="text-base font-semibold">{request.title}</h2>
        <p className="mt-2 text-sm text-stone-600">{request.description}</p>
        <div className="mt-4 space-y-1.5">
          <label htmlFor="step-up-password" className="text-sm font-medium">Confirm with your password</label>
          <input
            id="step-up-password"
            autoFocus
            type="password"
            name="actorPassword"
            autoComplete="current-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            className={inputCls}
            disabled={busy}
          />
          <p className="text-xs text-stone-500">Your own password, not the account you are changing.</p>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btnSecondary} disabled={busy} onClick={() => onClose(false)}>Cancel</button>
          <button type="submit" className={btnDanger} disabled={busy}>{busy ? 'Working…' : request.confirmLabel}</button>
        </div>
      </form>
    </div>
  );
}
