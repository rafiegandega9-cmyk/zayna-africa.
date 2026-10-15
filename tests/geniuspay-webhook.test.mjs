import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleGeniusPayWebhook } from "../src/lib/geniuspay-webhook.mjs";

const secret = "whsec_test_only";
const nowSeconds = 1_800_000_000;
const basePayload = {
  event: "payment.success",
  environment: "sandbox",
  data: {
    reference: "TXN-SANDBOX-1",
    amount: 6500,
    currency: "XOF",
    status: "completed",
    metadata: { order_id: "order-test-1" },
  },
};

function signedEvent(payload = basePayload, options = {}) {
  const timestamp = String(options.timestamp ?? nowSeconds);
  const rawBody = options.rawBody ?? JSON.stringify(payload);
  const signature = options.signature ?? createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return {
    secret,
    rawBody,
    timestamp,
    signature,
    environment: options.environment ?? "sandbox",
    eventHeader: options.eventHeader,
    nowSeconds,
  };
}

function makeRepository(overrides = {}) {
  const state = {
    order: { id: "order-test-1", total_xof: 6500, payment_status: "pending", geniuspay_reference: "TXN-SANDBOX-1" },
    reads: 0,
    updates: [],
    readError: null,
    updateError: null,
    beforeUpdate: null,
    ...overrides,
  };
  const repository = {
    async getOrder(id) {
      state.reads += 1;
      if (state.readError) return { data: null, error: state.readError };
      return { data: id === state.order?.id ? structuredClone(state.order) : null, error: null };
    },
    async updateUnpaidOrder(id, update) {
      if (state.updateError) return { data: null, error: state.updateError };
      state.beforeUpdate?.();
      if (!state.order || id !== state.order.id || state.order.payment_status === "paid") return { data: null, error: null };
      state.updates.push(structuredClone(update));
      Object.assign(state.order, update);
      return { data: { id }, error: null };
    },
  };
  return { state, repository };
}

test("rejects missing configuration, malformed timestamps, stale deliveries, and invalid signatures before database access", async () => {
  const { state, repository } = makeRepository();
  const missingConfig = await handleGeniusPayWebhook({ ...signedEvent(), secret: "", repository });
  const badTimestamp = await handleGeniusPayWebhook({ ...signedEvent(), timestamp: "bad", repository });
  const stale = await handleGeniusPayWebhook({ ...signedEvent(basePayload, { timestamp: nowSeconds - 301 }), repository });
  const badSignature = await handleGeniusPayWebhook({ ...signedEvent(basePayload, { signature: "00".repeat(32) }), repository });
  assert.equal(missingConfig.status, 503);
  assert.equal(badTimestamp.status, 400);
  assert.equal(stale.status, 400);
  assert.equal(badSignature.status, 401);
  assert.equal(state.reads, 0);
  assert.equal(state.updates.length, 0);
});

test("rejects body tampering, invalid JSON, environment mismatch, and conflicting event headers", async () => {
  const bodyTamperRepository = makeRepository();
  const original = signedEvent();
  const tampered = await handleGeniusPayWebhook({ ...original, rawBody: `${original.rawBody} `, repository: bodyTamperRepository.repository });
  assert.equal(tampered.status, 401);
  assert.equal(bodyTamperRepository.state.reads, 0);

  const invalidJsonRepository = makeRepository();
  assert.equal((await handleGeniusPayWebhook({ ...signedEvent(undefined, { rawBody: "{" }), repository: invalidJsonRepository.repository })).status, 400);
  assert.equal(invalidJsonRepository.state.reads, 0);

  const wrongEnvironmentRepository = makeRepository();
  assert.equal((await handleGeniusPayWebhook({ ...signedEvent(), environment: "live", repository: wrongEnvironmentRepository.repository })).status, 403);
  assert.equal(wrongEnvironmentRepository.state.reads, 0);

  const eventMismatchRepository = makeRepository();
  assert.equal((await handleGeniusPayWebhook({ ...signedEvent(basePayload, { eventHeader: "payment.failed" }), repository: eventMismatchRepository.repository })).status, 400);
  assert.equal(eventMismatchRepository.state.reads, 0);
});

test("rejects unknown orders and mismatched amount, currency, or saved reference", async () => {
  const unknown = makeRepository();
  assert.equal((await handleGeniusPayWebhook({ ...signedEvent({ ...basePayload, data: { ...basePayload.data, metadata: { order_id: "missing" } } }), repository: unknown.repository })).status, 409);

  for (const data of [
    { ...basePayload.data, amount: 1 },
    { ...basePayload.data, currency: "USD" },
    { ...basePayload.data, reference: "TXN-OTHER" },
  ]) {
    const { state, repository } = makeRepository();
    const result = await handleGeniusPayWebhook({ ...signedEvent({ ...basePayload, data }), repository });
    assert.equal(result.status, 409);
    assert.equal(state.updates.length, 0);
  }
});

test("marks only an authenticated completed sandbox event as paid and processing", async () => {
  const { state, repository } = makeRepository();
  const result = await handleGeniusPayWebhook({ ...signedEvent(), repository });
  assert.equal(result.status, 200);
  assert.equal(state.order.payment_status, "paid");
  assert.equal(state.order.order_status, "processing");
  assert.equal(state.order.geniuspay_reference, "TXN-SANDBOX-1");
  assert.equal(state.updates.length, 1);
});

test("maps refused, cancelled, and expired events to failed states", async () => {
  const variants = [
    ["payment.failed", "failed"],
    ["payment.cancelled", "failed"],
    ["payment.expired", "failed"],
  ];
  for (const [event, payment_status] of variants) {
    const { state, repository } = makeRepository();
    const payload = { ...basePayload, event, data: { ...basePayload.data, status: "failed" } };
    const result = await handleGeniusPayWebhook({ ...signedEvent(payload), repository });
    assert.equal(result.status, 200);
    assert.equal(state.order.payment_status, payment_status);
    assert.equal(state.order.order_status, "payment_failed");
  }
});

test("acknowledges pending/unknown payment events without changing the order", async () => {
  const { state, repository } = makeRepository();
  const payload = { ...basePayload, event: "payment.initiated", data: { ...basePayload.data, status: "pending" } };
  const result = await handleGeniusPayWebhook({ ...signedEvent(payload), repository });
  assert.equal(result.status, 200);
  assert.equal(state.order.payment_status, "pending");
  assert.equal(state.updates.length, 0);
});

test("duplicate success is idempotent and a late failure cannot downgrade a paid order", async () => {
  const { state, repository } = makeRepository();
  await handleGeniusPayWebhook({ ...signedEvent(), repository });
  const duplicate = await handleGeniusPayWebhook({ ...signedEvent(), repository });
  const lateFailurePayload = { ...basePayload, event: "payment.failed", data: { ...basePayload.data, status: "failed" } };
  const lateFailure = await handleGeniusPayWebhook({ ...signedEvent(lateFailurePayload), repository });
  assert.equal(duplicate.status, 200);
  assert.equal(lateFailure.status, 200);
  assert.equal(state.order.payment_status, "paid");
  assert.equal(state.order.order_status, "processing");
  assert.equal(state.updates.length, 1);
});

test("keeps paid status if a failure arrives after the read but before the conditional database update", async () => {
  const { state, repository } = makeRepository({ beforeUpdate() {
    state.order.payment_status = "paid";
    state.order.order_status = "processing";
  } });
  const failurePayload = { ...basePayload, event: "payment.failed", data: { ...basePayload.data, status: "failed" } };
  const result = await handleGeniusPayWebhook({ ...signedEvent(failurePayload), repository });
  assert.equal(result.status, 200);
  assert.equal(state.order.payment_status, "paid");
  assert.equal(state.order.order_status, "processing");
  assert.equal(state.updates.length, 0);
});

test("does not update when reading or writing Supabase returns an error", async () => {
  const readFailure = makeRepository({ readError: new Error("read failed") });
  assert.equal((await handleGeniusPayWebhook({ ...signedEvent(), repository: readFailure.repository })).status, 503);
  assert.equal(readFailure.state.updates.length, 0);

  const updateFailure = makeRepository({ updateError: new Error("update failed") });
  assert.equal((await handleGeniusPayWebhook({ ...signedEvent(), repository: updateFailure.repository })).status, 503);
  assert.equal(updateFailure.state.order.payment_status, "pending");
  assert.equal(updateFailure.state.updates.length, 0);
});
