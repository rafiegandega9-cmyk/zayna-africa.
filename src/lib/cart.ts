import type { Product } from "@/lib/products";

export type CartLine = { id: string; quantity: number };
export type CartDetail = CartLine & { product: Product; unitPrice: number; subtotal: number };

export function parseStoredCart(value: string | null): CartLine[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((line): line is CartLine => line !== null
      && typeof line === "object"
      && typeof line.id === "string"
      && line.id.length > 0
      && Number.isSafeInteger(line.quantity)
      && line.quantity > 0);
  } catch {
    return [];
  }
}

export function calculateCartLines(cart: CartLine[], products: Product[]): CartDetail[] {
  return cart.flatMap((line) => {
    const product = products.find((item) => item.id === line.id);
    return product ? [{ ...line, product, unitPrice: product.price, subtotal: product.price * line.quantity }] : [];
  });
}

export function calculateCartTotal(lines: Pick<CartDetail, "subtotal">[]): number {
  return lines.reduce((sum, line) => sum + line.subtotal, 0);
}

export function calculateGrandTotal(productTotal: number, deliveryFee: number): number {
  return productTotal + deliveryFee;
}
