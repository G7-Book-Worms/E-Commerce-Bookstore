// Shape of GET /api/cart -> data (see server/src/modules/cart/cart-service.ts)
export type CartLine = {
  cartItemId: number;
  bookId: number;
  format: "hardcover" | "paperback";
  quantity: number;
  title: string;
  author: string;
  isbn: string;
  coverImageUrl: string | null;
  regularPriceCents: number;
  salePriceCents: number | null;
  unitPriceCents: number;
  onSale: boolean;
  stock: number;
  lineTotalCents: number;
};

export type CartData = {
  cartId: number | null;
  items: CartLine[];
  totalCount: number;
  subtotalCents: number;
  totals: {
    subtotalCents: number;
    saleSavingsCents: number;
    discountCents: number;
    taxCents: number;
    totalCents: number;
  };
  discount: { code: string; label: string } | null;
  discountError: string | null;
};

// The discount code the shopper entered, kept for this browser tab so checkout uses it too
const KEY = "bookworms.discountCode";
export function loadDiscountCode(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
export function saveDiscountCode(code: string) {
  try {
    if (code) sessionStorage.setItem(KEY, code);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked (private mode): the code just won't carry over to checkout
  }
}
