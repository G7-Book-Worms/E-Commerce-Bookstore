import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { BCRYPT_COST, comparePassword, hashPassword, needsRehash } from './hash-utils';

test('passwords are stored as salted bcrypt hashes, never as text', async () => {
  const a = await hashPassword('Unix-Was-Born-1969!');
  const b = await hashPassword('Unix-Was-Born-1969!');
  assert.notEqual(a, b, 'same password, different salt');
  assert.ok(!a.includes('Unix'));
  assert.equal(bcrypt.getRounds(a), BCRYPT_COST);
  assert.ok(await comparePassword('Unix-Was-Born-1969!', a));
  assert.ok(!(await comparePassword('unix-was-born-1969!', a)));
});

test('older cost-10 hashes are flagged for upgrade', () => {
  assert.ok(needsRehash(bcrypt.hashSync('x', 10)));
  assert.ok(!needsRehash(bcrypt.hashSync('x', BCRYPT_COST)));
});
