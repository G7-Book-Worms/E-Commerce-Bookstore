import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskPhone, smsAvailable, toE164 } from './twilio-verify';

test('US numbers in everyday formats become E.164', () => {
  for (const raw of ['(210) 555-0142', '210-555-0142', '210.555.0142', '2105550142', '1 210 555 0142', '+1 210 555 0142']) {
    assert.equal(toE164(raw), '+12105550142', raw);
  }
});

test('international numbers need a leading +', () => {
  assert.equal(toE164('+44 20 7946 0958'), '+442079460958');
  assert.equal(toE164('442079460958'), null);
});

test('rejects things that cannot be phone numbers', () => {
  for (const raw of ['', '555-0142', '123', '(010) 555-0142', '+12', 'not a phone', '+1234567890123456']) {
    assert.equal(toE164(raw), null, raw);
  }
});

test('masking keeps only the last four digits', () => {
  assert.equal(maskPhone('+12105550142'), '•••-•••-0142');
});

test('SMS is off unless all three Twilio settings are present', () => {
  const keep = { ...process.env };
  try {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_VERIFY_SERVICE_SID;
    assert.equal(smsAvailable(), false);
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'x';
    assert.equal(smsAvailable(), false);
    process.env.TWILIO_VERIFY_SERVICE_SID = 'VA123';
    assert.equal(smsAvailable(), true);
  } finally {
    process.env = keep;
  }
});
