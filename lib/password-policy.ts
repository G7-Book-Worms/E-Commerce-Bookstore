// Password rules shared by the sign-up, change-password, reset and staff forms (client)
// and by the API (server), so both always agree. SCRUM-213.
import { z } from 'zod';

export const PASSWORD_MIN = 10;
// bcrypt only looks at the first 72 bytes; longer passwords would be silently truncated
export const PASSWORD_MAX_BYTES = 72;

// The most common leaked passwords plus obvious site-specific ones (lowercase, compared
// after removing digits/symbols from the ends so "Password123!" still matches "password").
const COMMON = new Set([
  'password', 'passw0rd', 'qwerty', 'qwertyuiop', 'letmein', 'welcome', 'admin', 'administrator',
  'iloveyou', 'monkey', 'dragon', 'football', 'baseball', 'sunshine', 'princess', 'starwars',
  'trustno1', 'superman', 'batman', 'master', 'shadow', 'michael', 'jennifer', 'abc', 'abcdef',
  'abcdefgh', 'changeme', 'secret', 'login', 'hello', 'freedom', 'whatever', 'computer',
  'internet', 'liverpool', 'chelsea', 'arsenal', 'charlie', 'donald', 'ninja', 'mustang',
  'access', 'flower', 'hunter', 'killer', 'soccer', 'hockey', 'pepper', 'cheese', 'summer',
  'winter', 'spring', 'autumn', 'january', 'october', 'november', 'december', 'texas',
  'spurs', 'roadrunner', 'utsa', 'bookworms', 'bookworm', 'bookwrms', 'books', 'reader',
  'library', 'qazwsx', 'asdfgh', 'asdfghjkl', 'zxcvbnm', 'aaaaaa', 'test', 'testing', 'guest',
]);

// The letters only, lowercased: "P@ssword123!" -> "pssword", "Password123!" -> "password"
function core(password: string) {
  return password.toLowerCase().replace(/[^a-z]/g, '');
}

/** A common word with only numbers/symbols and at most 2 extra letters around it */
function isCommon(password: string) {
  const letters = core(password);
  if (COMMON.has(letters)) return true;
  for (const word of COMMON) {
    if (word.length >= 5 && letters.includes(word) && letters.length - word.length <= 2) return true;
  }
  return false;
}

function isSequenceOrRepeat(password: string) {
  if (/^(.)\1+$/.test(password)) return true;
  const seqs = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const lower = password.toLowerCase();
  return seqs.some((s) => s.includes(lower) || s.split('').reverse().join('').includes(lower));
}

/** Problems with a new password, in plain English. Empty array = acceptable. */
export function passwordProblems(password: string, context: { email?: string; name?: string } = {}): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN) problems.push(`Use at least ${PASSWORD_MIN} characters`);
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) problems.push('Use at most 72 characters');
  if (!/[A-Z]/.test(password)) problems.push('Add an uppercase letter');
  if (!/[a-z]/.test(password)) problems.push('Add a lowercase letter');
  if (!/[0-9]/.test(password)) problems.push('Add a number');
  if (!/[^A-Za-z0-9]/.test(password)) problems.push('Add a symbol such as ! or #');

  const emailName = context.email?.split('@')[0]?.toLowerCase();
  if (isCommon(password) || isSequenceOrRepeat(password)) problems.push('This password is too common');
  else if (emailName && emailName.length >= 3 && password.toLowerCase().includes(emailName)) {
    problems.push("Don't use your email address in your password");
  } else if (context.name && context.name.length >= 3 && password.toLowerCase().includes(context.name.toLowerCase())) {
    problems.push("Don't use your name in your password");
  }
  return problems;
}

/** 0-4 for the strength meter: weak, fair, good, strong, excellent. */
export function passwordStrength(password: string): number {
  if (!password) return 0;
  let classes = 0;
  if (/[a-z]/.test(password)) classes++;
  if (/[A-Z]/.test(password)) classes++;
  if (/[0-9]/.test(password)) classes++;
  if (/[^A-Za-z0-9]/.test(password)) classes++;
  if (isCommon(password) || isSequenceOrRepeat(password)) return 0;
  let score = 0;
  if (password.length >= PASSWORD_MIN) score++;
  if (password.length >= 14) score++;
  if (password.length >= 18) score++;
  if (classes >= 3) score++;
  if (classes < 3) score = Math.min(score, 1);
  return Math.min(score, 4);
}

export const STRENGTH_LABELS = ['Too weak', 'Fair', 'Good', 'Strong', 'Excellent'] as const;

/** zod schema for any field that sets a new password */
export const newPasswordSchema = z
  .string({ required_error: 'Password is required' })
  .superRefine((value, ctx) => {
    const problems = passwordProblems(value);
    if (problems.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problems[0] });
  });
