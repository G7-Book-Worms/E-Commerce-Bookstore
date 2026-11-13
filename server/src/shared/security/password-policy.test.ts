import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordProblems, passwordStrength } from '../../../../lib/password-policy';

test('accepts a long mixed password', () => {
  assert.deepEqual(passwordProblems('Unix-Was-Born-1969!'), []);
  assert.ok(passwordStrength('Unix-Was-Born-1969!') >= 3);
});

test('keeps the demo password valid', () => {
  assert.deepEqual(passwordProblems('BookWorms123!').filter((p) => !p.includes('common')), []);
});

test('rejects short passwords and missing character types', () => {
  assert.ok(passwordProblems('Ab1!').some((p) => p.includes('10 characters')));
  assert.ok(passwordProblems('alllowercase1!').some((p) => p.includes('uppercase')));
  assert.ok(passwordProblems('NoSymbolsHere123').some((p) => p.includes('symbol')));
});

test('rejects common passwords with decorations', () => {
  for (const pw of ['Password123!', 'password123!A', 'Qwerty12345!', 'Welcome2026!!', 'Letmein!!2026']) {
    assert.ok(passwordProblems(pw).includes('This password is too common'), pw);
    assert.equal(passwordStrength(pw), 0, pw);
  }
});

test('rejects the email name inside the password', () => {
  assert.ok(passwordProblems('Ada.Lovelace-99!', { email: 'lovelace@example.com' }).some((p) => p.includes('email')));
});

test('rejects passwords longer than bcrypt can use', () => {
  assert.ok(passwordProblems('Aa1!' + 'x'.repeat(80)).some((p) => p.includes('72')));
});
