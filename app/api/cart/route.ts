// app/api/cart/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '../../../server/db';
import { carts, cartItems, CartItem } from '../../../server/src/modules/cart/cart-schema';
import { authenticateRequest } from '../../../server/src/shared/middleware/auth-middleware';

export async function POST(req: NextRequest) {
  try {
    let userId: number | null = null;
    try {
      const { user: payload } = authenticateRequest(req);
      userId = Number(payload.id);
    } catch {
      // Fallback guest identifier or unauthenticated default user
      userId = 1;
    }

    const { bookId, quantity = 1 } = await req.json();
    if (!bookId) {
      return NextResponse.json(
        { status: 'error', message: 'bookId is required' },
        { status: 400 }
      );
    }

    // Find or create cart for the user
    let [cart] = await db
      .select()
      .from(carts)
      .where(eq(carts.userId, userId))
      .limit(1);

    if (!cart) {
      const [newCart]: any = await db.insert(carts).values({ userId });
      const [created] = await db
        .select()
        .from(carts)
        .where(eq(carts.cartId, newCart.insertId))
        .limit(1);
      cart = created;
    }

    // Check if the book is already in the cart
    const [existingItem] = await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cart.cartId),
          eq(cartItems.bookId, Number(bookId))
        )
      )
      .limit(1);

    if (existingItem) {
      await db
        .update(cartItems)
        .set({ quantity: existingItem.quantity + Number(quantity) })
        .where(eq(cartItems.cartItemId, existingItem.cartItemId));
    } else {
      await db.insert(cartItems).values({
        cartId: cart.cartId,
        bookId: Number(bookId),
        quantity: Number(quantity),
      });
    }

    // Calculate total items count
    const allItems: CartItem[] = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, cart.cartId));

    const totalCount = allItems.reduce(
      (acc: number, item: CartItem) => acc + item.quantity,
      0
    );

    return NextResponse.json({
      status: 'success',
      message: 'Added to cart',
      data: { totalCount },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error.message || 'Failed to update cart' },
      { status: 500 }
    );
  }
}
export async function DELETE(req: NextRequest) {
  try {
    let userId: number = 1;
    try {
      const { user: payload } = authenticateRequest(req);
      userId = Number(payload.id);
    } catch {
      userId = 1;
    }

    const { bookId } = await req.json();
    if (!bookId) {
      return NextResponse.json({ status: 'error', message: 'bookId required' }, { status: 400 });
    }

    const [cart] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
    if (cart) {
      await db
        .delete(cartItems)
        .where(and(eq(cartItems.cartId, cart.cartId), eq(cartItems.bookId, Number(bookId))));

      const allItems: CartItem[] = await db
        .select()
        .from(cartItems)
        .where(eq(cartItems.cartId, cart.cartId));

      const totalCount = allItems.reduce((acc, item) => acc + item.quantity, 0);

      return NextResponse.json({
        status: 'success',
        message: 'Item removed from cart',
        data: { totalCount },
      });
    }

    return NextResponse.json({ status: 'success', data: { totalCount: 0 } });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error.message || 'Failed to remove from cart' },
      { status: 500 }
    );
  }
}