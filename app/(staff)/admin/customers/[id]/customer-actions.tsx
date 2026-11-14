'use client';

// Actions on one customer account. Which buttons appear depends on the role the server passed in,
// but that is only presentation: /api/staff/customers/:id decides again for every action, and the
// destructive ones are refused unless the staff member's own password comes with them.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { btnDanger, btnSecondary } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';
import { TempPasswordNotice } from '@/components/staff/temp-password-notice';
import { StepUpPrompt, type StepUpRequest } from '@/components/staff/step-up-prompt';

export function CustomerActions({
  userId,
  isActive,
  name,
  canManage,
  anonymised,
}: {
  userId: number;
  isActive: boolean;
  name: string;
  canManage: boolean;
  anonymised: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<StepUpRequest | null>(null);

  async function post(action: string, actorPassword?: string) {
    const res = await staffFetch<{ password?: string }>(`/api/staff/customers/${userId}`, 'PATCH', { action, actorPassword });
    if (res.ok) {
      setPassword(res.data?.password ?? null);
      router.refresh();
    }
    return res;
  }

  /** An action that does not need the password re-confirmed. */
  async function act(action: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    const res = await post(action);
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
  }

  /** An action that does: the server will refuse it without the password anyway. */
  function confirmThen(action: string, title: string, description: string, confirmLabel: string) {
    setMsg(null);
    setPrompt({
      title,
      description,
      confirmLabel,
      run: async (actorPassword) => {
        const res = await post(action, actorPassword);
        if (res.ok) setMsg({ ok: true, text: res.message });
        return res;
      },
    });
  }

  if (anonymised) {
    return <p className="text-sm text-stone-500">This account was deleted. Its personal details were removed; its orders are still in the order history.</p>;
  }

  return (
    <div className="space-y-3">
      <StepUpPrompt request={prompt} onClose={() => setPrompt(null)} />
      <div className="flex flex-col gap-2">
        <button type="button" disabled={busy} className={btnSecondary} onClick={() => act('send-reset-link', `Email ${name} a password reset link?`)}>
          Send password reset link
        </button>
        {canManage && (
          <>
            <button
              type="button"
              disabled={busy}
              className={btnSecondary}
              onClick={() => confirmThen(
                'temp-password',
                `Set a temporary password for ${name}`,
                `Their current password stops working, they are signed out everywhere, and you will be shown a one-time password to hand over.`,
                'Set temporary password',
              )}
            >
              Set temporary password
            </button>
            <button
              type="button"
              disabled={busy}
              className={btnSecondary}
              onClick={() => confirmThen(
                'force-reset',
                `Force ${name} to reset their password`,
                `They are signed out of every device, must choose a new password at the next sign-in, and get a reset link by email.`,
                'Force password reset',
              )}
            >
              Force password reset
            </button>
            <button type="button" disabled={busy} className={btnSecondary} onClick={() => act('sign-out', `Sign ${name} out of every device?`)}>
              Sign out everywhere
            </button>
            {isActive ? (
              <button
                type="button"
                disabled={busy}
                className={btnDanger}
                onClick={() => confirmThen(
                  'deactivate',
                  `Deactivate ${name}'s account`,
                  `They will not be able to sign in until it is reactivated, and they are signed out of every device now.`,
                  'Deactivate',
                )}
              >
                Deactivate account
              </button>
            ) : (
              <button type="button" disabled={busy} className={btnSecondary} onClick={() => act('activate', `Reactivate ${name}'s account?`)}>
                Reactivate account
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              className={btnDanger}
              onClick={() => confirmThen(
                'delete',
                `Delete ${name}'s account`,
                `Their name, email, phone and saved addresses are replaced with placeholders and the account is disabled. The order history is kept so sales figures and the staff order views still work. This cannot be undone.`,
                'Delete account',
              )}
            >
              Delete account
            </button>
          </>
        )}
      </div>
      {password && <TempPasswordNotice password={password} who={name} />}
      {msg && !password && <p role="status" className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
    </div>
  );
}
