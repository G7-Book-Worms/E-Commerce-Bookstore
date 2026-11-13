'use client';

// Strength meter + checklist under any "new password" field (SCRUM-213).
// Uses the same rules as the server (lib/password-policy.ts).
import { passwordProblems, passwordStrength, STRENGTH_LABELS } from '@/lib/password-policy';

const COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-600', 'bg-green-700'];

export function PasswordStrength({ password, email, id }: { password: string; email?: string; id?: string }) {
  if (!password) return null;
  const score = passwordStrength(password);
  const problems = passwordProblems(password, { email });
  const label = problems.length ? 'Not accepted yet' : STRENGTH_LABELS[score];
  return (
    <div id={id} className="mt-2 space-y-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < Math.max(score, 1) ? COLORS[problems.length ? 0 : score] : 'bg-stone-200'}`} />
        ))}
      </div>
      <p className={`text-xs ${problems.length ? 'text-red-700' : 'text-green-800'}`}>
        Strength: <span className="font-semibold">{label}</span>
        {problems.length > 0 && <> · {problems[0]}</>}
      </p>
    </div>
  );
}
