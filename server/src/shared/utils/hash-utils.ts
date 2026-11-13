import bcrypt from 'bcryptjs';

// bcrypt work factor (SCRUM-213). Each +1 doubles the time an attacker needs per guess.
// 12 takes roughly a quarter of a second per hash, which is fine for sign-in.
export const BCRYPT_COST = 12;

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, BCRYPT_COST);
}

export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

/** True for hashes made with an older, cheaper cost: re-hash them after a successful sign-in. */
export function needsRehash(hash: string): boolean {
  try {
    return bcrypt.getRounds(hash) < BCRYPT_COST;
  } catch {
    return true;
  }
}

// A real bcrypt hash of a random string. Compared against when the email doesn't exist,
// so a sign-in takes the same time whether or not the account exists (no user enumeration).
const DUMMY_HASH = '$2b$12$EuStSbLo9jcATnLHzuZN3egkHFy16Svy5fdc8jXKsjZJOlc8.UUhG';
export async function burnHashTime(plainText: string): Promise<void> {
  await bcrypt.compare(plainText, DUMMY_HASH);
}
