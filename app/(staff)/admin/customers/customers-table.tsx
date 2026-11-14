'use client';

// The customers list: a checkbox per row and a bulk action bar for the selected rows.
//
// Showing or hiding a button here is presentation only. Every action posts to the staff API, which
// re-reads the signed-in staff member's role from the database, decides again whether the action is
// allowed, re-confirms the password for the destructive ones, and checks each id individually.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, SortLink, Table, btnDanger, btnSecondary, dateOnly, money, td, th } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';
import { StepUpPrompt, type StepUpRequest } from '@/components/staff/step-up-prompt';

export interface CustomerRow {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  anonymised: boolean;
  created: string;
  orderCount: number;
  spentCents: number;
}

type BulkAction = 'deactivate' | 'activate' | 'force-reset' | 'delete';

export function CustomersTable({
  rows,
  params,
  canManage,
  maxBulk,
}: {
  rows: CustomerRow[];
  params: Record<string, string | undefined>;
  canManage: boolean;
  maxBulk: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<StepUpRequest | null>(null);

  // Rows that can be selected. A row already scrubbed by a delete has nothing left to act on.
  const selectable = useMemo(() => rows.filter((r) => !r.anonymised).map((r) => r.userId), [rows]);
  const allSelected = selectable.length > 0 && selected.length === selectable.length;

  function toggle(userId: number, on: boolean) {
    setSelected((prev) => (on ? [...new Set([...prev, userId])] : prev.filter((id) => id !== userId)));
    setMsg(null);
  }

  async function post(action: BulkAction, userIds: number[], actorPassword?: string) {
    const res = await staffFetch<{ message?: string }>('/api/staff/customers', 'POST', { action, userIds, actorPassword });
    if (res.ok) {
      setSelected([]);
      router.refresh();
    }
    return res;
  }

  async function run(action: BulkAction, label: string) {
    const ids = selected.slice(0, maxBulk);
    if (ids.length === 0) return;
    const many = `${ids.length} ${ids.length === 1 ? 'customer' : 'customers'}`;

    // Deactivate, force reset and delete ask for the password; reactivating does not.
    if (action === 'activate') {
      if (!window.confirm(`Reactivate ${many}?`)) return;
      setBusy(true);
      const res = await post(action, ids);
      setBusy(false);
      setMsg({ ok: res.ok, text: res.message });
      return;
    }

    const description =
      action === 'delete'
        ? `Names, email addresses, phone numbers and saved addresses are replaced with placeholders and the accounts are disabled. Order history is kept, so sales figures do not change. This cannot be undone.`
        : action === 'deactivate'
          ? `These customers will not be able to sign in, and they are signed out of every device.`
          : `These customers are signed out everywhere and must set a new password. A reset link is emailed to each of them.`;
    setPrompt({
      title: `${label} ${many}`,
      description,
      confirmLabel: label,
      run: async (actorPassword) => {
        const res = await post(action, ids, actorPassword);
        if (res.ok) setMsg({ ok: true, text: res.message });
        return res;
      },
    });
  }

  const tooMany = selected.length > maxBulk;

  return (
    <>
      <StepUpPrompt request={prompt} onClose={() => setPrompt(null)} />

      {canManage && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3"
          role="group"
          aria-label="Actions for the selected customers"
        >
          <span className="text-sm font-medium" aria-live="polite">
            {selected.length === 0 ? 'Select customers to act on them' : `${selected.length} selected`}
          </span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} disabled={busy || selected.length === 0 || tooMany} onClick={() => run('deactivate', 'Deactivate')}>Deactivate</button>
            <button type="button" className={btnSecondary} disabled={busy || selected.length === 0 || tooMany} onClick={() => run('activate', 'Reactivate')}>Reactivate</button>
            <button type="button" className={btnSecondary} disabled={busy || selected.length === 0 || tooMany} onClick={() => run('force-reset', 'Force password reset')}>Force password reset</button>
            <button type="button" className={btnDanger} disabled={busy || selected.length === 0 || tooMany} onClick={() => run('delete', 'Delete')}>Delete</button>
          </div>
          {selected.length > 0 && (
            <button type="button" className="text-sm text-stone-500 underline-offset-2 hover:underline" onClick={() => setSelected([])}>Clear</button>
          )}
        </div>
      )}
      {tooMany && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          Bulk actions take at most {maxBulk} accounts at a time. Deselect {selected.length - maxBulk} to continue.
        </p>
      )}
      {msg && <p role="status" className={`mb-3 text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}

      <Table>
        <thead>
          <tr>
            {canManage && (
              <th className={`${th} w-10`}>
                <input
                  type="checkbox"
                  aria-label="Select every customer on this page"
                  checked={allSelected}
                  disabled={selectable.length === 0}
                  onChange={(e) => { setSelected(e.target.checked ? selectable : []); setMsg(null); }}
                  className="size-4"
                />
              </th>
            )}
            <th className={th}><SortLink label="Name" column="name" params={params} basePath="/admin/customers" /></th>
            <th className={th}>Email</th>
            <th className={th}><SortLink label="Joined" column="joined" params={params} basePath="/admin/customers" /></th>
            <th className={th}><SortLink label="Orders" column="orders" params={params} basePath="/admin/customers" /></th>
            <th className={`${th} text-right`}><SortLink label="Spent" column="spent" params={params} basePath="/admin/customers" /></th>
            <th className={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.userId} className="hover:bg-stone-50">
              {canManage && (
                <td className={td}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${c.firstName} ${c.lastName}`}
                    checked={selected.includes(c.userId)}
                    disabled={c.anonymised}
                    onChange={(e) => toggle(c.userId, e.target.checked)}
                    className="size-4"
                  />
                </td>
              )}
              <td className={td}>
                <Link href={`/admin/customers/${c.userId}`} className="font-medium text-green-900 underline-offset-2 hover:underline">
                  {c.firstName} {c.lastName}
                </Link>
              </td>
              <td className={`${td} text-stone-600`}>{c.anonymised ? '—' : c.email}</td>
              <td className={`${td} whitespace-nowrap text-stone-600`}>{dateOnly(c.created)}</td>
              <td className={td}>{c.orderCount}</td>
              <td className={`${td} text-right`}>{money(c.spentCents)}</td>
              <td className={td}>
                <div className="flex flex-wrap gap-1">
                  {c.anonymised ? <Badge color="gray">Deleted</Badge> : c.isActive ? <Badge color="green">Active</Badge> : <Badge color="red">Deactivated</Badge>}
                  {c.mustChangePassword && <Badge color="amber">Must reset</Badge>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
