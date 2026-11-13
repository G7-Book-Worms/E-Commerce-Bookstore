'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, btnPrimary, btnSecondary, dateTime, inputCls } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';
import { TempPasswordNotice } from '@/components/staff/temp-password-notice';
import { ROLE_LABELS, type StaffRole } from '@/lib/staff-permissions';

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
}

export function StaffManager({ rows, meId, nextEmployeeId }: { rows: StaffRow[]; meId: number; nextEmployeeId: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', employeeId: nextEmployeeId, role: 'employee' as StaffRole });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [temp, setTemp] = useState<{ password: string; who: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function patch(r: StaffRow, body: Record<string, string>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    const res = await staffFetch<{ password?: string }>(`/api/staff/accounts/${r.adminId}`, 'PATCH', body);
    setBusy(false);
    setMsg({ ok: res.ok, text: `${r.firstName}: ${res.message}` });
    setTemp(res.ok && res.data?.password ? { password: res.data.password, who: `${r.firstName} ${r.lastName}` } : null);
    if (res.ok) router.refresh();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await staffFetch<{ password: string }>('/api/staff/accounts', 'POST', form);
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok && res.data) {
      setTemp({ password: res.data.password, who: `${form.firstName} ${form.lastName} (${form.employeeId})` });
      setForm({ firstName: '', lastName: '', email: '', employeeId: '', role: 'employee' });
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {temp && <TempPasswordNotice password={temp.password} who={temp.who} />}
      {msg && !temp && <p role="status" className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-stone-500">
            <tr><th className="py-2">Name</th><th>Employee ID</th><th>Role</th><th>Last sign-in</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const me = r.adminId === meId;
              return (
                <tr key={r.adminId} className="border-t border-stone-100 align-top">
                  <td className="py-2"><div className="font-medium">{r.firstName} {r.lastName}{me && <span className="text-stone-400"> (you)</span>}</div><div className="text-xs text-stone-500">{r.email}</div></td>
                  <td className="py-2 font-mono text-xs">{r.employeeId ?? '—'}</td>
                  <td className="py-2">
                    <label className="sr-only" htmlFor={`role-${r.adminId}`}>Role for {r.firstName}</label>
                    <select id={`role-${r.adminId}`} value={r.role} disabled={me || busy} className={`${inputCls} w-36`}
                      onChange={(e) => patch(r, { action: 'set-role', role: e.target.value }, `Make ${r.firstName} ${ROLE_LABELS[e.target.value as StaffRole]}?`)}>
                      {(['employee', 'manager', 'admin'] as StaffRole[]).map((x) => <option key={x} value={x}>{ROLE_LABELS[x]}</option>)}
                    </select>
                  </td>
                  <td className="py-2 text-xs text-stone-600">{dateTime(r.lastLogin)}</td>
                  <td className="py-2"><div className="flex flex-wrap gap-1">{r.isActive ? <Badge color="green">Active</Badge> : <Badge color="red">Deactivated</Badge>}{r.mustChangePassword && <Badge color="amber">Temp password</Badge>}</div></td>
                  <td className="py-2">
                    {!me && (
                      <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" disabled={busy} className={btnSecondary} onClick={() => patch(r, { action: 'temp-password' }, `Give ${r.firstName} a temporary password? They're signed out everywhere.`)}>Temp password</button>
                        <button type="button" disabled={busy} className={btnSecondary} onClick={() => patch(r, { action: r.isActive ? 'deactivate' : 'activate' }, r.isActive ? `Deactivate ${r.firstName}? They're signed out immediately.` : undefined)}>
                          {r.isActive ? 'Deactivate' : 'Reactivate'}
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

      <form onSubmit={create} className="rounded-lg border border-stone-200 bg-stone-50 p-4">
        <h2 className="mb-3 text-sm font-semibold">Add a staff member</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm"><span className="mb-1 block font-medium">First name</span><input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputCls} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Last name</span><input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputCls} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Work email</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Employee ID</span><input required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value.toUpperCase() })} className={`${inputCls} font-mono`} placeholder="BW-1005" /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Role</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })} className={inputCls}>
              {(['employee', 'manager', 'admin'] as StaffRole[]).map((x) => <option key={x} value={x}>{ROLE_LABELS[x]}</option>)}
            </select></label>
        </div>
        <button className={`${btnPrimary} mt-4`} disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="mt-2 text-xs text-stone-500">They get a one-time temporary password (shown here once) and must choose their own at first sign-in.</p>
      </form>
    </div>
  );
}
