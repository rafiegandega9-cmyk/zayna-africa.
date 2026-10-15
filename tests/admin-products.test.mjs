import assert from "node:assert/strict";
import test from "node:test";
import { validateProductEditableFields } from "../src/lib/admin-products.ts";

test("validates and normalizes editable product fields", () => {
  assert.deepEqual(validateProductEditableFields({
    name: "  Huile de baobab demo  ",
    description: "  Description de demonstration  ",
    price_xof: 9500,
    stock: 12,
    is_available: true,
  }), {
    updates: {
      name: "Huile de baobab demo",
      description: "Description de demonstration",
      price_xof: 9500,
      stock: 12,
      is_available: true,
    },
  });
});

test("rejects invalid product names, descriptions, prices, and stocks", () => {
  assert.ok("error" in validateProductEditableFields({ name: " " }));
  assert.ok("error" in validateProductEditableFields({ description: "x".repeat(2001) }));
  assert.ok("error" in validateProductEditableFields({ price_xof: -1 }));
  assert.ok("error" in validateProductEditableFields({ stock: 1.5 }));
  assert.ok("error" in validateProductEditableFields({ stock: 100001 }));
  assert.ok("error" in validateProductEditableFields({ is_available: "true" }));
  assert.ok("error" in validateProductEditableFields({ unrelated: true }));
});
