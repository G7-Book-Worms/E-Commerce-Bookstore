import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localPartProblem, mailboxesEnabled, suggestLocalPart } from './staff-mailbox';

test('suggests first.last in plain lowercase', () => {
  assert.equal(suggestLocalPart('Ada', 'Lovelace'), 'ada.lovelace');
  assert.equal(suggestLocalPart('Zoë', "O'Brien-Smith"), 'zoe.obrien-smith');
  assert.equal(suggestLocalPart('  Mary Ann ', 'Lee'), 'maryann.lee');
  assert.equal(suggestLocalPart('李', 'Wei'), 'wei');
});

test('accepts ordinary names', () => {
  for (const ok of ['ada.lovelace', 'j', 'jane-doe2', 'a.b.c']) assert.equal(localPartProblem(ok), null, ok);
});

test('refuses malformed names', () => {
  for (const bad of ['', '.ada', 'ada.', 'ada..lovelace', 'Ada', 'ada lovelace', 'ada+x', 'a'.repeat(41), 'ada@x']) {
    assert.notEqual(localPartProblem(bad), null, bad);
  }
});

test('refuses the store\'s shared addresses', () => {
  for (const reserved of ['support', 'no-reply', 'postmaster', 'admin', 'security']) {
    assert.match(localPartProblem(reserved) ?? '', /reserved/);
  }
});

test('off unless both Migadu settings are present', () => {
  const keep = { ...process.env };
  try {
    delete process.env.MIGADU_API_USER;
    delete process.env.MIGADU_API_KEY;
    assert.equal(mailboxesEnabled(), false);
    process.env.MIGADU_API_USER = 'owner@example.com';
    assert.equal(mailboxesEnabled(), false);
    process.env.MIGADU_API_KEY = 'k';
    assert.equal(mailboxesEnabled(), true);
  } finally {
    process.env = keep;
  }
});
