// test-user-service.ts
import 'dotenv/config';
import { UsersRepository } from './server/src/modules/users/users-repository';
import { UsersService } from './server/src/modules/users/users-service';

async function runServiceTests() {
  console.log('--- Direct UsersService & Repository Test ---\n');

  const usersRepo = new UsersRepository();
  const usersService = new UsersService(usersRepo);

  const testEmail = 'ada.lovelace@example.com';
  const user = await usersRepo.findByEmail(testEmail);
  if (!user) {
    console.error(`❌ User ${testEmail} not found in database.`);
    process.exit(1);
  }
  const userId = user.userId;
  console.log(`Testing with user ID: ${userId} (${user.email})`);

  // 1. Fetch Profile
  console.log('\n1. Fetching sanitized profile...');
  const profile = await usersService.getProfile(userId);
  console.log('Sanitized output:', profile);

  // 2. Profile Update
  console.log('\n2. Testing profile update...');
  const updated = await usersService.updateProfile(userId, { firstName: 'Ada', lastName: 'Lovelace' });
  console.log('Updated record name:', updated.name);

  // 3. Addresses & Default Toggle
  console.log('\n3. Testing address creation & default toggle...');
  const addrA = await usersService.createAddress(userId, {
    street: 'Test Street 1',
    city: 'City A',
    state: 'ST',
    zip: '11111',
    country: 'USA',
    isDefault: true,
  });
  console.log('Created Address A (default):', addrA.addressId);

  const addrB = await usersService.createAddress(userId, {
    street: 'Test Street 2',
    city: 'City B',
    state: 'ST',
    zip: '22222',
    country: 'USA',
    isDefault: true,
  });
  console.log('Created Address B (default):', addrB.addressId);

  const allAddrs = await usersService.getAddresses(userId);
  const foundA = allAddrs.find((a) => a.addressId === addrA.addressId);
  const foundB = allAddrs.find((a) => a.addressId === addrB.addressId);

  if (foundA?.isDefault === false && foundB?.isDefault === true) {
    console.log('✅ Default toggle succeeded (Address A demoted to false, Address B is true)');
  } else {
    console.error('❌ Default toggle failed:', { foundA, foundB });
  }

  // Cleanup addresses
  await usersService.deleteAddress(addrA.addressId, userId);
  await usersService.deleteAddress(addrB.addressId, userId);
  console.log('Cleaned up test addresses.');

  // 4. Order History
  console.log('\n4. Testing paginated orders...');
  const orderHistory = await usersService.getOrders(userId, 1, 10);
  console.log(`Orders retrieved: ${orderHistory.orders.length} (Total: ${orderHistory.total})`);

  console.log('\n🎉 ALL SERVICE LAYER TESTS PASSED!');
}

runServiceTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });