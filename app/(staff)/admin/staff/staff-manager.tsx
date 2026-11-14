'use client';

// The staff table and the "add a staff member" form.
//
// `actionableIds` and `assignable` come from the server, which worked them out from the roles in
// the database. They decide what this page draws. They are not the control: /api/staff/accounts
// re-reads the actor's role, re-checks canManage() and the actor/target ids, protects the owner and
// the last administrator, and re-confirms the password for anything destructive.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, btnDanger, btnPrimary, btnSecondary, dateOnly, dateTime, inputCls } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';
import { TempPasswordNotice } from '@/components/staff/temp-password-notice';
import { StepUpPrompt, type StepUpRequest } from '@/components/staff/step-up-prompt';
import { ROLE_LABELS, assignableRoles, type StaffRole } from '@/lib/staff-permissions';

interface StaffRow {
  adminId: number;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string | null;
  role: StaffRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLogin: string | null;
  created: string;
}

const DELETED_DOMAIN = '@deleted.invalid';

// Seniority, lowest first. Taken from the permission table rather than written out again, and used
// only to word the confirmation: the server decides for itself whether a change is a demotion.
const ROLE_ORDER: StaffRole[] = [...assignableRoles('owner'), 'owner'];

export function StaffManager({
  rows,
  meId,
  actionableIds,
  assignable,
  nextEmployeeId,
}: {
  rows: StaffRow[];
  meId: number;
  actionableIds: number[];
  assignable: StaffRole[];
  nextEmployeeId: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', employeeId: nextEmployeeId,
    role: (assignable[0] ?? 'employee') as StaffRole,
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [temp, setTemp] = useState<{ password: string; who: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<StepUpRequest | null>(null);

  const who = (r: StaffRow) => `${r.firstName} ${r.lastName}`;

  async function post(r: StaffRow, body: Record<string, string | undefined>) {
    const res = await staffFetch<{ password?: string }>(`/api/staff/accounts/${r.adminId}`, 'PATCH', body);
    setMsg({ ok: res.ok, text: `${r.firstName}: ${res.message}` });
    setTemp(res.ok && res.data?.password ? { password: res.data.password, who: who(r) } : null);
    if (res.ok) router.refresh();
    return res;
  }

  /** Reversible action: a plain confirm is enough, and the server does not ask for a password. */
  async function act(r: StaffRow, body: Record<string, string>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    await post(r, body);
    setBusy(false);
  }

  /** Destructive action: the server refuses it without the acting staff member's password. */
  function confirmThen(r: StaffRow, body: Record<string, string>, title: string, description: string, confirmLabel: string) {
    setMsg(null);
    setPrompt({ title, description, confirmLabel, run: (actorPassword) => post(r, { ...body, actorPassword }) });
  }

  function changeRole(r: StaffRow, next: StaffRole) {
    if (next === r.role) return;
    const demotion = ROLE_ORDER.indexOf(next) < ROLE_ORDER.indexOf(r.role);
    const body = { action: 'set-role', role: next };
    if (!demotion) {
      act(r, body, `Make ${who(r)} ${ROLE_LABELS[next]}?`);
      return;
    }
    confirmThen(
      r,
      body,
      `Change ${who(r)} to ${ROLE_LABELS[next]}`,
      `They lose everything their current role could do as soon as this is saved, including on any device they are already signed in on.`,
      `Make ${ROLE_LABELS[next]}`,
    );
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await staffFetch<{ password: string }>('/api/staff/accounts', 'POST', form);
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok && res.data) {
      setTemp({ password: res.data.password, who: `${form.firstName} ${form.lastName} (${form.employeeId})` });
      setForm({ firstName: '', lastName: '', email: '', employeeId: '', role: (assignable[0] ?? 'employee') as StaffRole });
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <StepUpPrompt request={prompt} onClose={() => setPrompt(null)} />
      {temp && <TempPasswordNotice password={temp.password} who={temp.who} />}
      {msg && !temp && <p role="status" className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="py-2">Employee ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last sign-in</th>
              <th>Created</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const me = r.adminId === meId;
              const deleted = r.email.endsWith(DELETED_DOMAIN);
              // Can this actor touch this row at all? Decided on the server; the owner, peers,
              // seniors and the actor's own row are all absent from this list.
              const actionable = actionableIds.includes(r.adminId) && !deleted;
              // Roles offered: the ones this actor may assign, plus the row's current role so the
              // select has something to show.
              const options = Array.from(new Set<StaffRole>([...assignable, r.role]));
              return (
                <tr key={r.adminId} className="border-t border-stone-100 align-top">
                  <td className="py-2 font-mono text-xs">{r.employeeId ?? '—'}</td>
                  <td className="py-2">
                    <div className="font-medium">{who(r)}{me && <span className="text-stone-400"> (you)</span>}</div>
                  </td>
                  <td className="py-2 text-xs text-stone-500">{deleted ? '—' : r.email}</td>
                  <td className="py-2">
                    {actionable ? (
                      <>
                        <label className="sr-only" htmlFor={`role-${r.adminId}`}>Role for {r.firstName}</label>
                        <select
                          id={`role-${r.adminId}`}
                          value={r.role}
                          disabled={busy}
                          className={`${inputCls} w-36`}
                          onChange={(e) => changeRole(r, e.target.value as StaffRole)}
                        >
                          {options.map((x) => <option key={x} value={x}>{ROLE_LABELS[x]}</option>)}
                        </select>
                      </>
                    ) : (
                      <span>{ROLE_LABELS[r.role]}</span>
                    )}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {deleted
                        ? <Badge color="gray">Deleted</Badge>
                        : r.isActive ? <Badge color="green">Active</Badge> : <Badge color="red">Deactivated</Badge>}
                      {r.mustChangePassword && !deleted && <Badge color="amber">Temp password</Badge>}
                    </div>
                  </td>
                  <td className="py-2 text-xs text-stone-600">{dateTime(r.lastLogin)}</td>
                  <td className="py-2 text-xs text-stone-600">{dateOnly(r.created)}</td>
                  <td className="py-2">
                    {actionable && (
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          className={btnSecondary}
                          onClick={() => confirmThen(
                            r,
                            { action: 'temp-password' },
                            `Reset ${who(r)}'s password`,
                            `Their password stops working, they are signed out everywhere, and you will be shown a one-time password to hand over.`,
                            'Force password reset',
                          )}
                        >
                          Force reset
                        </button>
                        {r.isActive ? (
                          <button
                            type="button"
                            disabled={busy}
                            className={btnSecondary}
                            onClick={() => confirmThen(
                              r,
                              { action: 'deactivate' },
                              `Deactivate ${who(r)}`,
                              `They are signed out immediately and cannot sign in to the portal until the account is reactivated.`,
                              'Deactivate',
                            )}
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button type="button" disabled={busy} className={btnSecondary} onClick={() => act(r, { action: 'activate' })}>
                            Reactivate
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          className={btnDanger}
                          onClick={() => confirmThen(
                            r,
                            { action: 'delete' },
                            `Delete ${who(r)}`,
                            `Their name, email and employee ID are replaced with placeholders, the account drops to Employee and is disabled, and they are signed out. What they did stays in the activity log and on the orders and tickets they handled. This cannot be undone.`,
                            'Delete account',
                          )}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {assignable.length === 0 ? (
        <p className="text-sm text-stone-500">Your role cannot create staff accounts.</p>
      ) : (
        <form onSubmit={create} className="rounded-lg border border-stone-200 bg-stone-50 p-4">
          <h2 className="mb-3 text-sm font-semibold">Add a staff member</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-sm"><span className="mb-1 block font-medium">First name</span><input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputCls} /></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Last name</span><input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputCls} /></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Work email</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Employee ID</span><input required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value.toUpperCase() })} className={`${inputCls} font-mono`} placeholder="BW-1005" /></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Role</span>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })} className={inputCls}>
                {assignable.map((x) => <option key={x} value={x}>{ROLE_LABELS[x]}</option>)}
              </select></label>
          </div>
          <button className={`${btnPrimary} mt-4`} disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
          <p className="mt-2 text-xs text-stone-500">They get a one-time temporary password (shown here once) and must choose their own at first sign-in.</p>
        </form>
      )}
    </div>
  );
}
