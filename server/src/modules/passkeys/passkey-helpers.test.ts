import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceName, relyingParty } from './passkey-helpers';

test('the passkey belongs to the host the request came to', () => {
  assert.deepEqual(relyingParty('https://bookwrms.store/api/passkeys/sign-in'), { rpID: 'bookwrms.store', origin: 'https://bookwrms.store' });
  assert.deepEqual(relyingParty('http://localhost:3000/api/passkeys'), { rpID: 'localhost', origin: 'http://localhost:3000' });
});

test('default passkey names say which device it is', () => {
  assert.equal(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'), 'iPhone');
  assert.equal(deviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'), 'Mac (Chrome)');
  assert.equal(deviceName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36 Edg/131.0'), 'Windows PC (Edge)');
  assert.equal(deviceName('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36'), 'Android (Chrome)');
  assert.equal(deviceName(null), 'This device');
});
