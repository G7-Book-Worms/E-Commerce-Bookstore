import { eq, and, ne, desc, sql, inArray } from 'drizzle-orm';
import { db } from '../../../db';
import { users, addresses, Address, NewAddress, User } from './users-schema';
import { orders, orderItems } from '../orders/orders-schema';
import { books } from '../books/books-schema';

export type NewUser = Omit<User, 'userId' | 'created' | 'updated' | 'isActive'> & { isActive?: boolean };

export class UsersRepository {
  async findByEmail(email: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user ?? null;
  }

  async findById(userId: number): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);
    return user ?? null;
  }

  // Create new customer account
  async createUser(input: NewUser): Promise<User> {
    const [result]: any = await db.insert(users).values({
      ...input,
      created: new Date(),
      updated: new Date(),
    });

    const newId = result.insertId;
    const createdUser = await this.findById(newId);
    if (!createdUser) {
      throw new Error('Failed to retrieve user after creation');
    }
    return createdUser;
  }

  // SCRUM-95: Check if another user owns this email
  async isEmailTakenByOtherUser(email: string, currentUserId: number): Promise<boolean> {
    const [existing] = await db
      .select({ id: users.userId })
      .from(users)
      .where(and(eq(users.email, email), ne(users.userId, currentUserId)))
      .limit(1);
    return !!existing;
  }

  // SCRUM-94: Update user profile attributes
  async updateProfile(userId: number, fields: Partial<Omit<User, 'userId' | 'created' | 'updated'>>): Promise<User | null> {
    await db
      .update(users)
      .set({ ...fields, updated: new Date() })
      .where(eq(users.userId, userId));
    return this.findById(userId);
  }

  // SCRUM-98: Persist newly hashed password
  async updatePasswordHash(userId: number, newHash: string): Promise<void> {
    await db
      .update(users)
      .set({ passwordHash: newHash, updated: new Date() })
      .where(eq(users.userId, userId));
  }

  // ==========================================
  // SCRUM-101 & SCRUM-102: Address Management
  // ==========================================

  async getAddressesByUserId(userId: number): Promise<Address[]> {
    return db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, userId))
      .orderBy(desc(addresses.isDefault), addresses.addressId);
  }

  async findAddressByIdAndUser(addressId: number, userId: number): Promise<Address | null> {
    const [address] = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.addressId, addressId), eq(addresses.userId, userId)))
      .limit(1);
    return address ?? null;
  }

  // SCRUM-102: Reset existing default addresses for this user
  async clearDefaultAddress(userId: number): Promise<void> {
    await db
      .update(addresses)
      .set({ isDefault: false })
      .where(eq(addresses.userId, userId));
  }

  async createAddress(userId: number, input: Omit<NewAddress, 'userId' | 'addressId'>): Promise<Address> {
    if (input.isDefault) {
      await this.clearDefaultAddress(userId);
    }

    const [result]: any = await db.insert(addresses).values({
      ...input,
      userId,
    });

    const newId = result.insertId;
    const [created] = await db
      .select()
      .from(addresses)
      .where(eq(addresses.addressId, newId));
    return created;
  }

  async updateAddress(addressId: number, userId: number, input: Partial<NewAddress>): Promise<Address | null> {
    if (input.isDefault) {
      await this.clearDefaultAddress(userId);
    }

    await db
      .update(addresses)
      .set(input)
      .where(and(eq(addresses.addressId, addressId), eq(addresses.userId, userId)));

    return this.findAddressByIdAndUser(addressId, userId);
  }

  async deleteAddress(addressId: number, userId: number): Promise<boolean> {
    const [res]: any = await db
      .delete(addresses)
      .where(and(eq(addresses.addressId, addressId), eq(addresses.userId, userId)));
    return res.affectedRows > 0;
  }

  // ==========================================
  // SCRUM-103: Order History Query
  // ==========================================

  async getUserOrdersPaginated(userId: number, limit: number = 10, offset: number = 0) {
    const userOrders = await db
      .select({
        orderId: orders.orderId,
        status: orders.status,
        note: orders.note,
        priceCents: orders.priceCents,
        shippingAddressId: orders.shippingAddressId,
        trackingNumber: orders.trackingNumber,
        created: orders.created,
      })
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.created), desc(orders.orderId))
      .limit(limit)
      .offset(offset);

    const [countResult]: any = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(eq(orders.userId, userId));

    return {
      orders: userOrders,
      total: Number(countResult?.count || 0),
    };
  }

  // Line items (with book title/author) for a set of orders, in one query
  async getOrderItemsForOrders(orderIds: number[]) {
    if (orderIds.length === 0) return [];
    return db
      .select({
        orderItemId: orderItems.orderItemId,
        orderId: orderItems.orderId,
        bookId: orderItems.bookId,
        title: books.title,
        author: books.author,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
      })
      .from(orderItems)
      .innerJoin(books, eq(books.bookId, orderItems.bookId))
      .where(inArray(orderItems.orderId, orderIds))
      .orderBy(orderItems.orderItemId);
  }
}