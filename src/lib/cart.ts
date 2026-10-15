import type { Product } from "@/lib/products";

export type CartLine = { id: string; quantity: number };
export type CartDetail = CartLine & { product: Product; unitPrice: number; subtotal: number };

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
