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
  const checkoutUrl = typeof payment.checkout_url === "string" ? payment.checkout_url : payment.payment_url;
  if (typeof checkoutUrl !== "string") return false;
  try {
    const url = new URL(checkoutUrl);
    return payment.amount === expectedAmount
      && payment.currency === "XOF"
      && payment.environment === "sandbox"
      && payment.status === "pending"
      && url.protocol === "https:"
      && url.hostname === "geniuspay.ci"
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}
