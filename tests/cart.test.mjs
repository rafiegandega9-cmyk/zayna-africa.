import assert from "node:assert/strict";
import test from "node:test";
import { calculateCartLines, calculateCartTotal, calculateGrandTotal, parseStoredCart } from "../src/lib/cart.ts";
import { getDeliveryFeeXof } from "../src/lib/delivery.ts";

const catalog = [
  { id: "baobab", name: "Huile de baobab", price: 12000 },
  { id: "argan", name: "Huile d’argan pure", price: 14500 },
  { id: "ghassoul", name: "Ghassoul minéral", price: 9500 },
];

test("affiche le prix unitaire et calcule chaque sous-total puis le total général", () => {
  const lines = calculateCartLines([
    { id: "baobab", quantity: 2 },
    { id: "argan", quantity: 3 },
    { id: "ghassoul", quantity: 1 },
  ], catalog);

  assert.deepEqual(lines.map(({ unitPrice, quantity, subtotal }) => ({ unitPrice, quantity, subtotal })), [
    { unitPrice: 12000, quantity: 2, subtotal: 24000 },
    { unitPrice: 14500, quantity: 3, subtotal: 43500 },
    { unitPrice: 9500, quantity: 1, subtotal: 9500 },
  ]);
  assert.equal(calculateCartTotal(lines), 77000);
  assert.equal(calculateGrandTotal(calculateCartTotal(lines), 1500), 78500);
});

test("recalcule le total après diminution d’une quantité", () => {
  const lines = calculateCartLines([
    { id: "baobab", quantity: 1 },
    { id: "argan", quantity: 3 },
    { id: "ghassoul", quantity: 1 },
  ], catalog);
  assert.equal(lines.find((line) => line.id === "baobab")?.subtotal, 12000);
  assert.equal(calculateCartTotal(lines), 65000);
});

test("recalcule le total après suppression d’un produit", () => {
  const lines = calculateCartLines([
    { id: "baobab", quantity: 1 },
    { id: "argan", quantity: 3 },
  ], catalog);
  assert.equal(calculateCartTotal(lines), 55500);
});

test("applies each validated city delivery fee and leaves other cities unpriced", () => {
  assert.equal(getDeliveryFeeXof("Abidjan"), 1500);
  assert.equal(getDeliveryFeeXof(" abidjan "), 1500);
  assert.equal(getDeliveryFeeXof("Yamoussoukro"), 2000);
  assert.equal(getDeliveryFeeXof("Bouaké"), 3000);
  assert.equal(getDeliveryFeeXof("San Pedro"), 3000);
  assert.equal(getDeliveryFeeXof("San-Pédro"), 3000);
  assert.equal(calculateGrandTotal(77000, getDeliveryFeeXof("Abidjan")), 78500);
  assert.equal(calculateGrandTotal(77000, getDeliveryFeeXof("Yamoussoukro")), 79000);
  assert.equal(calculateGrandTotal(77000, getDeliveryFeeXof("Bouaké")), 80000);
  assert.equal(calculateGrandTotal(77000, getDeliveryFeeXof("San-Pédro")), 80000);
  assert.equal(getDeliveryFeeXof("Autre ville"), null);
  assert.equal(getDeliveryFeeXof("toString"), null);
});

test("restores only valid product IDs and integer quantities from the saved browser cart", () => {
  assert.deepEqual(parseStoredCart(JSON.stringify([
    { id: "baobab", quantity: 2 },
    { id: "argan", quantity: "3" },
    { id: "", quantity: 1 },
    { id: "ghassoul", quantity: 0 },
    null,
  ])), [{ id: "baobab", quantity: 2 }]);
  assert.deepEqual(parseStoredCart("invalid-json"), []);
  assert.deepEqual(parseStoredCart(null), []);
});
