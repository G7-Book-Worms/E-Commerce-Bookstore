// test-auth-pipeline.ts
import 'dotenv/config'; // Loads .env into process.env

import { UsersRepository } from './server/src/modules/users/users-repository';
import { AuthService } from './server/src/modules/auth/auth-service';
import { comparePassword } from './server/src/shared/utils/hash-utils';
import { generateToken, verifyToken } from './server/src/shared/utils/token-util';

async function runAuthDiagnostics() {
  console.log('--- [Step 1: Environment Variables Check] ---');
  console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
  
  if (!process.env.JWT_SECRET) {
    console.error('❌ FAIL: JWT_SECRET is missing from environment.');
    return;
  }
  console.log('✅ PASS: Required environment variables are present.\n');

  console.log('--- [Step 2: Database User Query Check] ---');
  const targetEmail = 'ada.lovelace@example.com'; // <--- Change to the email in your DB
  const usersRepo = new UsersRepository();
  
  let dbUser: any = null;
  try {
    dbUser = await usersRepo.findByEmail(targetEmail);
    console.log('Query result:', dbUser);
    
    if (!dbUser) {
      console.error(`❌ FAIL: No user found with email "${targetEmail}".`);
      return;
    }
    console.log('✅ PASS: User record fetched from MySQL.\n');
  } catch (err: any) {
    console.error('❌ FAIL: Database query crashed!');
    console.error('Possible column mismatch (e.g. password_hash vs passwordHash):', err.message);
    return;
  }

  console.log('--- [Step 3: Bcrypt Password Verification] ---');
  const testPassword = 'Password123!'; // <--- Plaintext password you are attempting to test
  try {
    console.log('Stored hash in DB:', dbUser.passwordHash);
    const isMatch = await comparePassword(testPassword, dbUser.passwordHash);
    console.log(`Password "${testPassword}" match result:`, isMatch);

    if (!isMatch) {
      console.error('❌ FAIL: Password does not match the stored hash.');
    } else {
      console.log('✅ PASS: Password matches stored hash successfully.\n');
    }
  } catch (err: any) {
    console.error('❌ FAIL: Bcrypt crashed during comparison:', err.message);
    return;
  }

  console.log('--- [Step 4: JWT Token Utility Check] ---');
  try {
    const payload = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role as 'customer' | 'admin',
    };
    const signedToken = generateToken(payload);
    console.log('Signed token preview:', signedToken.slice(0, 30) + '...');
    
    const verified = verifyToken(signedToken);
    console.log('Verified payload:', verified);
    console.log('✅ PASS: JWT signing and verification succeeded.\n');
  } catch (err: any) {
    console.error('❌ FAIL: JWT utility threw an error:', err.message);
    return;
  }

  console.log('--- [Step 5: Full AuthService.login() End-to-End Check] ---');
  try {
    const authService = new AuthService(usersRepo);
    const loginResult = await authService.login({
      email: targetEmail,
      password: testPassword,
    });
    console.log('Login result:', loginResult);
    console.log('\n🎉 ALL CHECKS PASSED: The backend core logic is fully working!');
  } catch (err: any) {
    console.error('❌ FAIL: AuthService.login() threw an error:', err.message);
  }
}

runAuthDiagnostics()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Unexpected crash:', err);
    process.exit(1);
  });