export type GeniusPaySandboxConfig = {
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  siteUrl?: string;
};

export function isGeniusPaySandboxConfigured(config: GeniusPaySandboxConfig): boolean {
  if (!config.apiKey?.startsWith("pk_sandbox_") || !config.apiSecret?.startsWith("sk_sandbox_")) return false;
  if (!config.webhookSecret?.startsWith("whsec_") || config.webhookSecret.length <= "whsec_".length) return false;
  try {
    const siteUrl = new URL(config.siteUrl ?? "");
    return siteUrl.protocol === "https:" && !siteUrl.username && !siteUrl.password;
  } catch {
    return false;
  }
}

export function isValidSandboxCheckoutResponse(payment: {
  amount?: unknown;
  currency?: unknown;
  environment?: unknown;
  status?: unknown;
  checkout_url?: unknown;
  payment_url?: unknown;
}, expectedAmount: number): boolean {
  return getSandboxCheckoutUrl(payment, expectedAmount).url !== null;
}

export function getSandboxCheckoutUrl(payment: {
  amount?: unknown;
  currency?: unknown;
  environment?: unknown;
  status?: unknown;
  checkout_url?: unknown;
  payment_url?: unknown;
}, expectedAmount: number): { url: string | null; reason: string | null } {
  if (payment.amount !== expectedAmount) return { url: null, reason: "amount_mismatch" };
  if (payment.currency !== "XOF") return { url: null, reason: "currency_mismatch" };
  if (payment.environment !== "sandbox") return { url: null, reason: "environment_mismatch" };
  if (payment.status !== "pending") return { url: null, reason: "status_mismatch" };

  const candidates = [payment.checkout_url, payment.payment_url].filter((value): value is string => typeof value === "string" && value.length > 0);
  if (!candidates.length) return { url: null, reason: "checkout_url_missing" };
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:"
        && ["geniuspay.ci", "pay.genius.ci"].includes(url.hostname)
        && !url.username
        && !url.password) {
        return { url: url.toString(), reason: null };
      }
    } catch {
      // Try the alternate documented checkout URL field, if present.
    }
  }
  return { url: null, reason: "checkout_url_untrusted" };
}
