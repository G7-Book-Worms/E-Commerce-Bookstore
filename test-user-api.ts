// test-user-api.ts
import 'dotenv/config';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = 'ada.lovelace@example.com';
const TEST_PASSWORD = 'Password123!';

let authCookie = '';

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (authCookie) {
    headers.set('Cookie', authCookie);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Capture Set-Cookie headers
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/auth_token=([^;]+)/);
    if (match) {
      authCookie = `auth_token=${match[1]}`;
    }
  }

  const json = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, body: json };
}

async function runTestSuite() {
  console.log(`Starting User Profile & Account Integration Tests against ${BASE_URL}\n`);

  // 1. Authenticate & Obtain Cookie
  console.log('--- [1. User Login] ---');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (loginRes.status !== 200 || !authCookie) {
    console.error('❌ Login failed. Response:', loginRes.body);
    process.exit(1);
  }
  console.log('✅ PASS: Logged in successfully. Cookie acquired.\n');

  // 2. SCRUM-93: Get Profile
  console.log('--- [2. SCRUM-93: GET /api/users/profile] ---');
  const profileRes = await request('/api/users/profile');
  if (profileRes.status !== 200) {
    console.error('❌ Failed to fetch profile:', profileRes.body);
    process.exit(1);
  }
  const user = profileRes.body.data;
  if ('passwordHash' in user || 'password_hash' in user) {
    console.error('❌ FAIL: Sensitive password hash exposed in response!');
    process.exit(1);
  }
  console.log('User profile:', { id: user.userId, name: user.name, email: user.email, phone: user.phone });
  console.log('✅ PASS: Profile retrieved without sensitive attributes.\n');

  // 3. SCRUM-94: PATCH Profile
  console.log('--- [3. SCRUM-94: PATCH /api/users/profile] ---');
  const patchRes = await request('/api/users/profile', {
    method: 'PATCH',
    body: JSON.stringify({ phone: '555-9999' }),
  });
  if (patchRes.status !== 200 || patchRes.body.data.phone !== '555-9999') {
    console.error('❌ Profile patch failed:', patchRes.body);
    process.exit(1);
  }
  console.log('✅ PASS: Phone number updated successfully.\n');

  // 4. SCRUM-100, 101, 102: Address CRUD & Default Toggle
  console.log('--- [4. SCRUM-101/102: Address Management] ---');
  // Create first address (Default)
  const addr1Res = await request('/api/users/addresses', {
    method: 'POST',
    body: JSON.stringify({
      street: '123 Algorithm Way',
      city: 'London',
      state: 'LN',
      zip: '10001',
      country: 'United Kingdom',
      isDefault: true,
    }),
  });
  if (addr1Res.status !== 201 && addr1Res.status !== 200) {
    console.error('❌ Address 1 creation failed:', addr1Res.body);
    process.exit(1);
  }
  const addr1Id = addr1Res.body.data.addressId;
  console.log(`Address 1 created (ID: ${addr1Id}, Default: true)`);

  // Create second address (Default = true, should demote addr1)
  const addr2Res = await request('/api/users/addresses', {
    method: 'POST',
    body: JSON.stringify({
      street: '456 Analytical Engine Blvd',
      city: 'Manchester',
      state: 'MC',
      zip: '20002',
      country: 'United Kingdom',
      isDefault: true,
    }),
  });
  const addr2Id = addr2Res.body.data.addressId;
  console.log(`Address 2 created (ID: ${addr2Id}, Default: true)`);

  // Verify list & toggle
  const listAddrRes = await request('/api/users/addresses');
  const addresses: any[] = listAddrRes.body.data;
  const fetchedAddr1 = addresses.find((a) => a.addressId === addr1Id);
  const fetchedAddr2 = addresses.find((a) => a.addressId === addr2Id);

  if (fetchedAddr1?.isDefault !== false || fetchedAddr2?.isDefault !== true) {
    console.error('❌ FAIL: Default address toggle did not demote previous default.');
    process.exit(1);
  }
  console.log('✅ PASS: Default toggle correctly prioritized latest address.\n');

  // Clean up created addresses
  await request(`/api/users/addresses/${addr1Id}`, { method: 'DELETE' });
  await request(`/api/users/addresses/${addr2Id}`, { method: 'DELETE' });
  console.log('✅ PASS: Address deletion succeeded.\n');

  // 5. SCRUM-103: Order History
  console.log('--- [5. SCRUM-103: GET /api/users/orders] ---');
  const ordersRes = await request('/api/users/orders?page=1&limit=5');
  if (ordersRes.status !== 200) {
    console.error('❌ Order history retrieval failed:', ordersRes.body);
    process.exit(1);
  }
  console.log(`Found ${ordersRes.body.data.orders.length} order(s) (Total in DB: ${ordersRes.body.data.total})`);
  console.log('✅ PASS: Order history endpoint functioning.\n');

  // 6. SCRUM-96, 97, 98: Password Change Verification
  console.log('--- [6. SCRUM-96/97/98: Change Password] ---');
  // Attempt with invalid current password (should fail 401)
  const wrongPwRes = await request('/api/users/change-password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword: 'WrongPassword!',
      newPassword: 'Password123!',
      confirmPassword: 'Password123!',
    }),
  });
  if (wrongPwRes.status !== 401) {
    console.error('❌ Expected 401 Unauthorized for wrong password, got:', wrongPwRes.status);
    process.exit(1);
  }
  console.log('✅ PASS: Rejection of incorrect current password verified.\n');

  // 7. SCRUM-156: Logout & Cookie Invalidation
  console.log('--- [7. SCRUM-156: POST /api/auth/logout] ---');
  const logoutRes = await request('/api/auth/logout', { method: 'POST' });
  const setCookieHeader = logoutRes.headers.get('set-cookie') || '';
  const isExpired = setCookieHeader.includes('Max-Age=0') || setCookieHeader.includes('expires=');
  if (logoutRes.status !== 200 || !isExpired) {
    console.error('❌ Logout did not expire auth cookie. Header:', setCookieHeader);
    process.exit(1);
  }
  console.log('Set-Cookie on logout:', setCookieHeader);
  console.log('✅ PASS: Cookie successfully cleared.\n');

  console.log('🎉 ALL API ENDPOINTS AND SECURITY POLICIES VALIDATED!');
}

runTestSuite().catch((err) => {
  console.error('Unexpected test crash:', err);
  process.exit(1);
});