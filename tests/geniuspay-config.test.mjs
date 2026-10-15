import assert from "node:assert/strict";
import test from "node:test";
import { getSandboxCheckoutUrl, isGeniusPaySandboxConfigured, isValidSandboxCheckoutResponse } from "../src/lib/geniuspay-config.ts";

const sandboxConfig = {
  apiKey: "pk_sandbox_demo_only",
  apiSecret: "sk_sandbox_demo_only",
  webhookSecret: "whsec_demo_only",
  siteUrl: "https://zayna-demo.example",
};

test("accepts a complete sandbox configuration with a public HTTPS origin", () => {
  assert.equal(isGeniusPaySandboxConfigured(sandboxConfig), true);
});

test("rejects live keys and incomplete or non-HTTPS payment configuration", () => {
  assert.equal(isGeniusPaySandboxConfigured({ ...sandboxConfig, apiKey: "pk_live_demo_only", apiSecret: "sk_live_demo_only" }), false);
  assert.equal(isGeniusPaySandboxConfigured({ ...sandboxConfig, webhookSecret: "" }), false);
  assert.equal(isGeniusPaySandboxConfigured({ ...sandboxConfig, siteUrl: "http://localhost:3000" }), false);
});

test("accepts only a pending XOF sandbox checkout with the expected amount and official host", () => {
  const payment = { amount: 10000, currency: "XOF", environment: "sandbox", status: "pending", checkout_url: "https://geniuspay.ci/checkout/demo" };
  assert.equal(isValidSandboxCheckoutResponse(payment, 10000), true);
  assert.equal(isValidSandboxCheckoutResponse({ ...payment, amount: 10001 }, 10000), false);
  assert.equal(isValidSandboxCheckoutResponse({ ...payment, environment: "live" }, 10000), false);
  assert.equal(isValidSandboxCheckoutResponse({ ...payment, checkout_url: "https://evil.example/checkout" }, 10000), false);
  assert.equal(isValidSandboxCheckoutResponse({ ...payment, checkout_url: "http://geniuspay.ci/checkout/demo" }, 10000), false);
});

test("accepts the alternate official GeniusPay host and tries payment_url if checkout_url is unusable", () => {
  const payment = { amount: 10000, currency: "XOF", environment: "sandbox", status: "pending" };
  assert.equal(getSandboxCheckoutUrl({ ...payment, checkout_url: "https://pay.genius.ci/checkout/MTX-demo" }, 10000).url, "https://pay.genius.ci/checkout/MTX-demo");
  assert.equal(getSandboxCheckoutUrl({ ...payment, checkout_url: "", payment_url: "https://geniuspay.ci/checkout/MTX-demo" }, 10000).url, "https://geniuspay.ci/checkout/MTX-demo");
  assert.equal(getSandboxCheckoutUrl({ ...payment, checkout_url: "https://untrusted.example/pay", payment_url: "https://evil.example/pay" }, 10000).reason, "checkout_url_untrusted");
});
