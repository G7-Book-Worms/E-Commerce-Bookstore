import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteUrl } from './site-url';

test('a preview links to its own branch address, even when SITE_URL is set', () => {
  assert.equal(siteUrl({ VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: 'bookwrms-git-x.vercel.app', SITE_URL: 'https://bookwrms.store' }), 'https://bookwrms-git-x.vercel.app');
});

test('production uses SITE_URL without a trailing slash', () => {
  assert.equal(siteUrl({ VERCEL_ENV: 'production', SITE_URL: 'https://bookwrms.store/' }), 'https://bookwrms.store');
});

test('falls back to the Vercel production domain, then localhost', () => {
  assert.equal(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'bookwrms.store' }), 'https://bookwrms.store');
  assert.equal(siteUrl({}), 'http://localhost:3000');
});
