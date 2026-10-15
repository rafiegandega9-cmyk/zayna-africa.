import assert from "node:assert/strict";
import test from "node:test";
import { getAdminOrderUpdate } from "../src/lib/order-update.mjs";

test("allows a whitelisted administrative order-state update without changing payment state", () => {
  const result = getAdminOrderUpdate({
    type: "order",
    id: "order-test-1",
    order_status: "shipped",
    payment_status: "paid",
  }, "2026-10-15T12:00:00.000Z");
  assert.deepEqual(result, {
    id: "order-test-1",
    updates: { order_status: "shipped", updated_at: "2026-10-15T12:00:00.000Z" },
  });
  assert.equal(Object.hasOwn(result.updates, "payment_status"), false);
});

test("rejects payment-state writes and unknown administrative order states", () => {
  assert.equal(getAdminOrderUpdate({ type: "order", id: "order-test-1", payment_status: "paid" }), null);
  assert.equal(getAdminOrderUpdate({ type: "order", id: "order-test-1", order_status: "paid" }), null);
  assert.equal(getAdminOrderUpdate({ type: "order", id: 42, order_status: "shipped" }), null);
});
