import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.GENIUSPAY_WEBHOOK_SECRET;
  const db = createAdminClient();
  if (!secret || !db) return NextResponse.json({ error: "Webhook non configuré." }, { status: 503 });
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-webhook-timestamp") ?? "";
  const signature = request.headers.get("x-webhook-signature") ?? "";
  const seconds = Number(timestamp);
  if (!/^\d{10,}$/.test(timestamp) || !Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return NextResponse.json({ error: "Timestamp webhook invalide." }, { status: 400 });
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "hex"); } catch { return NextResponse.json({ error: "Signature invalide." }, { status: 401 }); }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  let payload: { id?: string; event?: string; environment?: string; data?: { reference?: string; amount?: number; currency?: string; status?: string; metadata?: { order_id?: string } } };
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Payload invalide." }, { status: 400 }); }
  if (request.headers.get("x-webhook-environment") !== "sandbox" || payload.environment !== "sandbox") return NextResponse.json({ error: "Seuls les webhooks sandbox sont acceptés pour cette démonstration." }, { status: 403 });
  const headerEvent = request.headers.get("x-webhook-event");
  if (headerEvent && payload.event && headerEvent !== payload.event) return NextResponse.json({ error: "Événement webhook incohérent." }, { status: 400 });
  const event = payload.event ?? headerEvent;
  const orderId = payload.data?.metadata?.order_id;
  if (!orderId || !payload.data?.reference || !Number.isFinite(payload.data.amount)) return NextResponse.json({ error: "Données de paiement manquantes." }, { status: 400 });
  const { data: order, error } = await db.from("orders").select("id,total_xof,payment_status,geniuspay_reference").eq("id", orderId).maybeSingle();
  if (error) return NextResponse.json({ error: "Vérification de commande impossible." }, { status: 503 });
  if (!order || order.total_xof !== payload.data.amount || payload.data.currency !== "XOF" || (order.geniuspay_reference && order.geniuspay_reference !== payload.data.reference)) return NextResponse.json({ error: "La commande ne correspond pas au paiement." }, { status: 409 });
  const completed = event === "payment.success" && payload.data.status === "completed";
  const failed = ["payment.failed", "payment.cancelled", "payment.expired"].includes(event ?? "");
  if (!completed && !failed) return NextResponse.json({ received: true });
  if (order.payment_status === "paid") return NextResponse.json({ received: true });
  const { data: updatedOrder, error: updateError } = await db.from("orders").update({ payment_status: completed ? "paid" : "failed", order_status: completed ? "processing" : "payment_failed", geniuspay_reference: payload.data.reference }).eq("id", orderId).neq("payment_status", "paid").select("id").maybeSingle();
  if (updateError) return NextResponse.json({ error: "Mise à jour de commande impossible." }, { status: 503 });
  if (!updatedOrder) return NextResponse.json({ received: true });
  return NextResponse.json({ received: true });
}
