import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { requireHuman, BotCheckError, TURNSTILE_HEADER } from './turnstile';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.TURNSTILE_SECRET_KEY;
});

const req = (token?: string) => new Request('https://bookwrms.store/api/auth/login', { method: 'POST', headers: token ? { [TURNSTILE_HEADER]: token } : {} });
function cloudflareSays(body: unknown, seen?: (form: URLSearchParams) => void) {
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    seen?.(init.body as URLSearchParams);
    return new Response(JSON.stringify(body));
  }) as typeof fetch;
}

test('skipped entirely when no secret key is configured', async () => {
  await requireHuman(req(), '1.2.3.4');
});

test('a missing token is refused without calling Cloudflare', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  let called = false;
  globalThis.fetch = (async () => { called = true; return new Response('{}'); }) as typeof fetch;
  await assert.rejects(requireHuman(req(), '1.2.3.4'), BotCheckError);
  assert.equal(called, false);
});

test('a token Cloudflare accepts passes, and the secret, token and IP are sent', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  let form: URLSearchParams | undefined;
  cloudflareSays({ success: true, action: 'login' }, (f) => (form = f));
  await requireHuman(req('tok'), '1.2.3.4', 'login');
  assert.equal(form?.get('secret'), 'secret');
  assert.equal(form?.get('response'), 'tok');
  assert.equal(form?.get('remoteip'), '1.2.3.4');
});

test('a rejected token, or one minted for another form, is refused', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  cloudflareSays({ success: false, 'error-codes': ['invalid-input-response'] });
  await assert.rejects(requireHuman(req('tok'), null, 'login'), BotCheckError);
  cloudflareSays({ success: true, action: 'contact' });
  await assert.rejects(requireHuman(req('tok'), null, 'login'), BotCheckError);
});

test('fails closed when Cloudflare is unreachable', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  globalThis.fetch = (async () => { throw new TypeError('network'); }) as typeof fetch;
  await assert.rejects(requireHuman(req('tok'), null), BotCheckError);
});
