import assert from "node:assert/strict";
import test from "node:test";
import { handleCheckoutRequest } from "../src/lib/checkout-service.mjs";

const config = {
  apiKey: "pk_sandbox_test_only",
  apiSecret: "sk_sandbox_test_only",
  webhookSecret: "whsec_test_only",
  siteUrl: "https://zayna-preview.example",
};

const catalog = [{ id: "savon-noir", name: "Savon noir", price_xof: 5000, stock: 4, is_available: true }];
const checkoutBody = {
  customer: { name: "Aminata", email: "aminata@example.test", phone: "0700000000" },
  shipping: { city: "Abidjan", district: "Cocody", address: "Rue de test 123", note: "" },
  items: [{ productId: "savon-noir", quantity: 1 }],
  expectedTotal: 6500,
};

function makeRepository(overrides = {}) {
  const state = { products: catalog, orders: [], updates: [], productReads: 0, ...overrides };
  const repository = {
    async getProducts(ids) {
      state.productReads += 1;
      if (state.catalogError) return { data: null, error: state.catalogError };
      return { data: state.products.filter((product) => ids.includes(product.id)), error: null };
    },
    async createOrder(order) {
      if (state.insertError) return { error: state.insertError };
      state.orders.push(structuredClone(order));
      return { error: null };
    },
    async markInitializationFailed(orderId) {
      state.updates.push({ orderId, payment_status: "initialization_failed" });
      const order = state.orders.find((entry) => entry.id === orderId);
      if (order) order.payment_status = "initialization_failed";
      return { error: null };
    },
    async savePaymentReference(orderId, reference) {
      if (state.referenceError) return { error: state.referenceError };
      const order = state.orders.find((entry) => entry.id === orderId);
      if (order) order.geniuspay_reference = reference;
      return { error: null };
    },
  };
  return { state, repository };
}

function validProviderResponse(overrides = {}) {
  return new Response(JSON.stringify({ success: true, data: {
    reference: "TXN-SANDBOX-1", amount: 6500, currency: "XOF", status: "pending", environment: "sandbox",
    checkout_url: "https://geniuspay.ci/checkout/test-only", ...overrides,
  } }), { status: 201, headers: { "content-type": "application/json" } });
}

function dependencies(repository, paymentFetch, overrides = {}) {
  return { repository, ...config, paymentFetch, logProviderIssue() {}, ...overrides };
}

test("creates an awaiting-payment order from server catalogue prices and sends the existing sandbox contract", async () => {
  const { state, repository } = makeRepository();
  let providerRequest;
  const result = await handleCheckoutRequest(checkoutBody, dependencies(repository, async (url, options) => {
    providerRequest = { url, options };
    return validProviderResponse();
  }));

  assert.equal(result.status, 200);
  assert.equal(result.body.checkoutUrl, "https://geniuspay.ci/checkout/test-only");
  assert.equal(state.orders.length, 1);
  assert.equal(state.orders[0].payment_status, "pending");
  assert.equal(state.orders[0].order_status, "awaiting_payment");
  assert.equal(state.orders[0].total_xof, 6500);
  assert.equal(state.orders[0].items[0].unit_price_xof, 5000);
  assert.equal(state.orders[0].geniuspay_reference, "TXN-SANDBOX-1");
  assert.equal(providerRequest.url, "https://geniuspay.ci/api/v1/merchant/payments");
  assert.equal(providerRequest.options.headers["X-API-Key"], config.apiKey);
  assert.equal(providerRequest.options.headers["X-API-Secret"], config.apiSecret);
  const requestBody = JSON.parse(providerRequest.options.body);
  assert.equal(requestBody.amount, 6500);
  assert.equal(requestBody.currency, "XOF");
  assert.equal(requestBody.metadata.order_id, state.orders[0].id);
  assert.equal(requestBody.success_url, `${config.siteUrl}/?payment=return&order_id=${state.orders[0].id}`);
  assert.equal(requestBody.error_url, `${config.siteUrl}/?payment=return&order_id=${state.orders[0].id}`);
  assert.equal(requestBody.error_url, requestBody.success_url);
});

test("uses the documented data.payment_url checkout link when data.checkout_url is absent", async () => {
  const { state, repository } = makeRepository();
  const responseWithPaymentUrl = new Response(JSON.stringify({ success: true, data: {
    reference: "TXN-SANDBOX-PAYMENT-URL", amount: 6500, currency: "XOF", status: "pending", environment: "sandbox",
    payment_url: "https://geniuspay.ci/checkout/TXN-SANDBOX-PAYMENT-URL",
  } }), { status: 201, headers: { "content-type": "application/json" } });

  const result = await handleCheckoutRequest(checkoutBody, dependencies(repository, async () => responseWithPaymentUrl));
  assert.equal(result.status, 200);
  assert.equal(result.body.checkoutUrl, "https://geniuspay.ci/checkout/TXN-SANDBOX-PAYMENT-URL");
  assert.equal(state.orders[0].payment_status, "pending");
  assert.equal(state.orders[0].geniuspay_reference, "TXN-SANDBOX-PAYMENT-URL");
});

test("accepts an HTTP 201 checkout response with an authorized URL regardless of provider initialization status", async () => {
  const { state, repository } = makeRepository();
  const result = await handleCheckoutRequest(checkoutBody, dependencies(repository, async () => validProviderResponse({ status: "created" })));

  assert.equal(result.status, 200);
  assert.equal(result.body.checkoutUrl, "https://geniuspay.ci/checkout/test-only");
  assert.equal(state.orders[0].payment_status, "pending");
  assert.equal(state.orders[0].order_status, "awaiting_payment");
});

test("rejects malformed contact, unsupported delivery city, and invalid quantity before creating an order", async () => {
  const { state, repository } = makeRepository();
  let paymentCalls = 0;
  const paymentFetch = async () => { paymentCalls += 1; return validProviderResponse(); };

  assert.equal((await handleCheckoutRequest(null, dependencies(repository, paymentFetch))).status, 400);
  assert.equal((await handleCheckoutRequest({ ...checkoutBody, shipping: { ...checkoutBody.shipping, city: "Korhogo" } }, dependencies(repository, paymentFetch))).status, 422);
  assert.equal((await handleCheckoutRequest({ ...checkoutBody, items: [{ productId: "savon-noir", quantity: 0 }] }, dependencies(repository, paymentFetch))).status, 400);
  assert.equal(state.orders.length, 0);
  assert.equal(paymentCalls, 0);
});

test("rejects a client total that differs from the server-calculated total", async () => {
  const { state, repository } = makeRepository();
  let paymentCalls = 0;
  const result = await handleCheckoutRequest({ ...checkoutBody, expectedTotal: 1 }, dependencies(repository, async () => { paymentCalls += 1; return validProviderResponse(); }));
  assert.equal(result.status, 409);
  assert.equal(result.body.code, "PRICE_CHANGED");
  assert.deepEqual(result.body.quote, {
    items: [{ productId: "savon-noir", unitPriceXof: 5000 }],
    productTotalXof: 5000,
    deliveryFeeXof: 1500,
    totalXof: 6500,
  });
  assert.equal(state.orders.length, 0);
  assert.equal(paymentCalls, 0);
});

test("reconciles a stale browser price and only creates checkout after explicit retry at the quoted total", async () => {
  const updatedCatalog = [{ ...catalog[0], price_xof: 6000 }];
  const { state, repository } = makeRepository({ products: updatedCatalog });
  let paymentCalls = 0;
  const paymentFetch = async () => { paymentCalls += 1; return validProviderResponse({ amount: 7500 }); };

  const staleAttempt = await handleCheckoutRequest(checkoutBody, dependencies(repository, paymentFetch));
  assert.equal(staleAttempt.status, 409);
  assert.equal(staleAttempt.body.code, "PRICE_CHANGED");
  assert.equal(staleAttempt.body.quote.totalXof, 7500);
  assert.equal(staleAttempt.body.quote.items[0].unitPriceXof, 6000);
  assert.equal(state.orders.length, 0);
  assert.equal(paymentCalls, 0);

  const confirmedRetry = await handleCheckoutRequest({ ...checkoutBody, expectedTotal: staleAttempt.body.quote.totalXof }, dependencies(repository, paymentFetch));
  assert.equal(confirmedRetry.status, 200);
  assert.equal(state.orders[0].total_xof, 7500);
  assert.equal(state.orders[0].items[0].unit_price_xof, 6000);
  assert.equal(paymentCalls, 1);
});

test("rejects unavailable or insufficient stock and never calls the provider", async () => {
  const unavailable = makeRepository({ products: [{ ...catalog[0], is_available: false }] });
  const noStock = makeRepository({ products: [{ ...catalog[0], stock: 0 }] });
  let paymentCalls = 0;
  const paymentFetch = async () => { paymentCalls += 1; return validProviderResponse(); };
  assert.equal((await handleCheckoutRequest(checkoutBody, dependencies(unavailable.repository, paymentFetch))).status, 409);
  assert.equal((await handleCheckoutRequest(checkoutBody, dependencies(noStock.repository, paymentFetch))).status, 409);
  assert.equal(unavailable.state.orders.length + noStock.state.orders.length, 0);
  assert.equal(paymentCalls, 0);
});

test("does not call the provider when catalogue lookup or order insertion fails", async () => {
  const catalogueFailure = makeRepository({ catalogError: new Error("test catalog failure") });
  const insertFailure = makeRepository({ insertError: new Error("test insert failure") });
  let paymentCalls = 0;
  const paymentFetch = async () => { paymentCalls += 1; return validProviderResponse(); };
  assert.equal((await handleCheckoutRequest(checkoutBody, dependencies(catalogueFailure.repository, paymentFetch))).status, 503);
  assert.equal((await handleCheckoutRequest(checkoutBody, dependencies(insertFailure.repository, paymentFetch))).status, 503);
  assert.equal(paymentCalls, 0);
});

test("rejects incomplete sandbox configuration before catalogue access or order creation", async () => {
  const { state, repository } = makeRepository();
  let paymentCalls = 0;
  const result = await handleCheckoutRequest(checkoutBody, dependencies(repository, async () => { paymentCalls += 1; return validProviderResponse(); }, { webhookSecret: "", siteUrl: "http://localhost:3000" }));
  assert.equal(result.status, 503);
  assert.equal(state.productReads, 0);
  assert.equal(state.orders.length, 0);
  assert.equal(paymentCalls, 0);
});

test("marks the order initialization_failed after a provider 401 or network error", async () => {
  const unauthorized = makeRepository();
  const providerDiagnostics = [];
  const unauthorizedResult = await handleCheckoutRequest(checkoutBody, dependencies(unauthorized.repository, async () => new Response("unauthorized", { status: 401 }), { logProviderIssue: (details) => providerDiagnostics.push(details) }));
  assert.equal(unauthorizedResult.status, 502);
  assert.equal(unauthorizedResult.body.code, "GENIUSPAY_AUTH_REJECTED");
  assert.match(unauthorizedResult.body.error, /HTTP 401/);
  assert.deepEqual(providerDiagnostics, [{ httpStatus: 401, providerAccepted: false, responseDataPresent: false }]);
  assert.equal(JSON.stringify({ body: unauthorizedResult.body, logs: providerDiagnostics }).includes("unauthorized"), false);
  assert.equal(unauthorized.state.orders[0].payment_status, "initialization_failed");
  assert.equal(unauthorized.state.updates.length, 1);

  const networkFailure = makeRepository();
  const networkResult = await handleCheckoutRequest(checkoutBody, dependencies(networkFailure.repository, async () => { throw new Error("simulated network error"); }));
  assert.equal(networkResult.status, 502);
  assert.equal(networkFailure.state.orders[0].payment_status, "initialization_failed");
  assert.equal(networkFailure.state.updates.length, 1);
});

test("reports the safe validation reason when GeniusPay returns an unexpected checkout URL", async () => {
  const { state, repository } = makeRepository();
  const providerDiagnostics = [];
  const result = await handleCheckoutRequest(checkoutBody, dependencies(repository, async () => validProviderResponse({ checkout_url: "https://untrusted.example/pay" }), { logProviderIssue: (details) => providerDiagnostics.push(details) }));
  assert.equal(result.status, 502);
  assert.equal(result.body.code, "GENIUSPAY_INVALID_RESPONSE");
  assert.match(result.body.error, /lien de checkout Sandbox valide/);
  assert.deepEqual(providerDiagnostics, [{ httpStatus: 201, providerAccepted: true, reason: "checkout_url_untrusted" }]);
  assert.equal(state.orders[0].payment_status, "initialization_failed");
});

test("rejects malformed, live, or unexpected checkout responses and records initialization failure", async () => {
  const cases = [
    () => new Response("not json", { status: 201 }),
    () => validProviderResponse({ environment: "live" }),
    () => validProviderResponse({ checkout_url: "https://untrusted.example/checkout" }),
    () => validProviderResponse({ amount: 9999 }),
  ];
  for (const makeResponse of cases) {
    const { state, repository } = makeRepository();
    const result = await handleCheckoutRequest(checkoutBody, dependencies(repository, async () => makeResponse()));
    assert.equal(result.status, 502);
    assert.equal(state.orders[0].payment_status, "initialization_failed");
    assert.equal(state.updates.length, 1);
  }
});

test("returns an explicit error if the provider session exists but the reference cannot be saved", async () => {
  const { state, repository } = makeRepository({ referenceError: new Error("simulated reference write failure") });
  const result = await handleCheckoutRequest(checkoutBody, dependencies(repository, async () => validProviderResponse()));
  assert.equal(result.status, 503);
  assert.equal(state.orders[0].payment_status, "pending");
  assert.equal(state.orders[0].geniuspay_reference, undefined);
});
