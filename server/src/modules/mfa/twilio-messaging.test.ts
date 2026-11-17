import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textBody, textingAvailable } from './twilio-messaging';

test('every text says who it is from, on one line', () => {
  assert.equal(textBody('order #12 has shipped.\n Track it: https://x'), 'Book Worms: order #12 has shipped. Track it: https://x');
});

test('marketing-style texts carry the opt-out line', () => {
  assert.match(textBody('order #12 was cancelled.', true), /Reply STOP to opt out\.$/);
  assert.doesNotMatch(textBody('security alert'), /STOP/);
});

test('texting stays off until an approved sender number is configured', () => {
  const keep = { ...process.env };
  try {
    process.env.TWILIO_ACCOUNT_SID = 'AC1';
    process.env.TWILIO_AUTH_TOKEN = 't';
    delete process.env.TWILIO_MESSAGING_FROM;
    assert.equal(textingAvailable(), false);
    process.env.TWILIO_MESSAGING_FROM = '+18885550100';
    assert.equal(textingAvailable(), true);
  } finally {
    process.env = keep;
  }
});
