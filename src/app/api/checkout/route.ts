import { NextResponse } from "next/server";
import { handleCheckoutRequest } from "@/lib/checkout-service.mjs";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Données de commande invalides." }, { status: 400 }); }

  const db = createAdminClient();
  const repository = db ? {
    async getProducts(ids: string[]) {
      return db.from("products").select("id,name,price_xof,stock,is_available").in("id", ids);
    },
    async createOrder(order: Record<string, unknown>) {
      return db.from("orders").insert(order);
    },
    async markInitializationFailed(orderId: string) {
      return db.from("orders").update({ payment_status: "initialization_failed" }).eq("id", orderId);
    },
    async savePaymentReference(orderId: string, reference: string | null) {
      return db.from("orders").update({ geniuspay_reference: reference }).eq("id", orderId);
    },
  } : null;

  const result = await handleCheckoutRequest(body, {
    repository,
    apiKey: process.env.GENIUSPAY_API_KEY,
    apiSecret: process.env.GENIUSPAY_API_SECRET,
    webhookSecret: process.env.GENIUSPAY_WEBHOOK_SECRET,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  });
  return NextResponse.json(result.body, { status: result.status });
}
