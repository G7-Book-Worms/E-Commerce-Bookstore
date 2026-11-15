// Runs slow side work (sending email, texts) after the response has gone out, so a sign-in
// doesn't wait the ~10-20 seconds the mail server can take. On Vercel, Next's after() keeps the
// function alive until the work finishes. Outside a request (scripts, tests) it just runs now.
import { after } from 'next/server';

export function inBackground(work: () => Promise<unknown>): void {
  const run = () => work().catch((err) => console.error('[background] task failed', err instanceof Error ? err.message : err));
  try {
    after(run);
  } catch {
    void run();
  }
}
