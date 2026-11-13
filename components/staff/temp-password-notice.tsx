'use client';

import { useState } from 'react';

// Shows a just-created temporary password once, with a copy button.
export function TempPasswordNotice({ password, who }: { password: string; who: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
      <p className="font-medium text-amber-900">Temporary password for {who}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded bg-white px-2 py-1 font-mono text-base">{password}</code>
        <button
          type="button"
          className="rounded border border-amber-400 bg-white px-2 py-1 text-xs hover:bg-amber-100"
          onClick={async () => { await navigator.clipboard.writeText(password); setCopied(true); }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-2 text-xs text-amber-900">Share it with them directly (not by email). It is shown only once; they must change it when they sign in.</p>
    </div>
  );
}
