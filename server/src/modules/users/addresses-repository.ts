import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../../db';
import { addresses, Address, NewAddress } from './users-schema';

export class AddressesRepository {
  async getAddressesByUserId(userId: number): Promise<Address[]> {
    return db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, userId))
      .orderBy(desc(addresses.isDefault), addresses.addressId);
  }

  async findByIdAndUser(addressId: number, userId: number): Promise<Address | null> {
    const [address] = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.addressId, addressId), eq(addresses.userId, userId)))
      .limit(1);
    return address ?? null;
  }

  async clearDefaultAddress(userId: number, executor: any = db): Promise<void> {
    await executor
      .update(addresses)
      .set({ isDefault: false })
      .where(eq(addresses.userId, userId));
  }

  async createAddress(
    userId: number,
    input: Omit<NewAddress, 'userId' | 'addressId'>
  ): Promise<Address> {
    return db.transaction(async (tx) => {
      if (input.isDefault) {
        await this.clearDefaultAddress(userId, tx);
      }

      const [result]: any = await tx.insert(addresses).values({
        ...input,
        userId,
      });

      const [created] = await tx
        .select()
        .from(addresses)
        .where(eq(addresses.addressId, result.insertId));
      return created;
    });
  }

  async updateAddress(
    addressId: number,
    userId: number,
    input: Partial<NewAddress>
  ): Promise<Address | null> {
    return db.transaction(async (tx) => {
      if (input.isDefault) {
        await this.clearDefaultAddress(userId, tx);
      }

      await tx
        .update(addresses)
        .set(input)
        .where(and(eq(addresses.addressId, addressId), eq(addresses.userId, userId)));

      const [updated] = await tx
        .select()
        .from(addresses)
        .where(and(eq(addresses.addressId, addressId), eq(addresses.userId, userId)));
      return updated ?? null;
    });
  }

  async deleteAddress(addressId: number, userId: number): Promise<boolean> {
    const [res]: any = await db
      .delete(addresses)
      .where(and(eq(addresses.addressId, addressId), eq(addresses.userId, userId)));
    return res.affectedRows > 0;
  }
}