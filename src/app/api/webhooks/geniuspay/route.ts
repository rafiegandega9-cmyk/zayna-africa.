import { NextResponse } from "next/server";
import { handleGeniusPayWebhook } from "@/lib/geniuspay-webhook.mjs";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const db = createAdminClient();
  const repository = db ? {
    async getOrder(orderId: string) {
      return db.from("orders").select("id,total_xof,payment_status,geniuspay_reference").eq("id", orderId).maybeSingle();
    },
    async updateUnpaidOrder(orderId: string, update: { payment_status: string; order_status: string; geniuspay_reference: string }) {
      return db.from("orders").update(update).eq("id", orderId).neq("payment_status", "paid").select("id").maybeSingle();
    },
  } : null;

  const result = await handleGeniusPayWebhook({
    secret: process.env.GENIUSPAY_WEBHOOK_SECRET,
    repository,
    rawBody: await request.text(),
    timestamp: request.headers.get("x-webhook-timestamp") ?? "",
    signature: request.headers.get("x-webhook-signature") ?? "",
    environment: request.headers.get("x-webhook-environment") ?? "",
    eventHeader: request.headers.get("x-webhook-event") ?? undefined,
  });
  return NextResponse.json(result.body, { status: result.status });
}
