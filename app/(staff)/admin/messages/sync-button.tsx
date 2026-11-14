'use client';

// "Check mail now" - asks the server to pull from support@ outside the usual one-minute
// cooldown. The server is still the only thing that holds the credentials.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { btnSecondary } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';

export function SyncButton({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!configured) {
    return <span className="text-xs text-stone-500">Mail sync is not configured here</span>;
  }

  async function check() {
    setBusy(true);
    const res = await staffFetch('/api/staff/tickets/sync', 'POST');
    setBusy(false);
    setMsg(res.message);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btnSecondary} onClick={check} disabled={busy}>
        {busy ? 'Checking…' : 'Check mail now'}
      </button>
      {msg && <span role="status" className="text-xs text-stone-600">{msg}</span>}
    </div>
  );
}
