'use client';

// Dashboard panel for administrators and the owner: every account locked out of signing in right
// now, with "Unlock Sign-In". The API checks the role and the password again for every unlock
// (and, for staff accounts, that this administrator may manage that account).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { btnSecondary } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';
import { StepUpPrompt, type StepUpRequest } from '@/components/staff/step-up-prompt';

export interface LockedRow {
  kind: 'customer' | 'staff';
  id: number;
  name: string;
  email: string;
  roleLabel?: string;
  /** Formatted end of the lock */
  until: string;
}

export function LockedAccountsPanel({ rows }: { rows: LockedRow[] }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState<StepUpRequest | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function unlock(r: LockedRow) {
    setMsg(null);
    const url = r.kind === 'customer' ? `/api/staff/customers/${r.id}` : `/api/staff/accounts/${r.id}`;
    setPrompt({
      title: `Unlock Sign-In for ${r.name}`,
      description: `This ends the lock now so they can sign in again. Only do this once you have confirmed it is really them. They will be notified by email.`,
      confirmLabel: 'Unlock Sign-In',
      run: async (actorPassword) => {
        const res = await staffFetch(url, 'PATCH', { action: 'unlock-signin', actorPassword });
        if (res.ok) {
          setMsg({ ok: true, text: `${r.name}: ${res.message}` });
          router.refresh();
        }
        return res;
      },
    });
  }

  return (
    <>
      <StepUpPrompt request={prompt} onClose={() => setPrompt(null)} />
      {msg && <p role="status" className={`mb-2 text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-stone-500">No accounts are locked right now.</p>
      ) : (
        <ul className="divide-y divide-stone-100 text-sm">
          {rows.map((r) => (
            <li key={`${r.kind}-${r.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <Link
                  href={r.kind === 'customer' ? `/admin/customers/${r.id}` : '/admin/staff'}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {r.name}
                </Link>
                <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600">
                  {r.kind === 'customer' ? 'Customer' : `Staff${r.roleLabel ? ` · ${r.roleLabel}` : ''}`}
                </span>
                <p className="truncate text-xs text-stone-500">{r.email} · locked until {r.until}</p>
              </div>
              <button type="button" className={btnSecondary} onClick={() => unlock(r)}>Unlock Sign-In</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
