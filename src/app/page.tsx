import Boutique from "@/components/boutique";
import { getPublicCatalog } from "@/lib/products-server";
import { isGeniusPaySandboxConfigured } from "@/lib/geniuspay-config";

export default async function Home() {
  const catalog = await getPublicCatalog();
  const sandboxPaymentReady = Boolean(process.env.SUPABASE_SECRET_KEY) && isGeniusPaySandboxConfigured({
    apiKey: process.env.GENIUSPAY_API_KEY,
    apiSecret: process.env.GENIUSPAY_API_SECRET,
    webhookSecret: process.env.GENIUSPAY_WEBHOOK_SECRET,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  });
  return <Boutique products={catalog.products} previewCatalog={catalog.preview} catalogUnavailable={catalog.unavailable} sandboxPaymentReady={sandboxPaymentReady} />;
}
