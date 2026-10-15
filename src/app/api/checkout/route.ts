import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateGrandTotal } from "@/lib/cart";
import { getDeliveryFeeXof } from "@/lib/delivery";
import { isGeniusPaySandboxConfigured, isValidSandboxCheckoutResponse } from "@/lib/geniuspay-config";

export const runtime = "nodejs";

type CheckoutBody = {
  customer?: { name?: string; email?: string; phone?: string };
  shipping?: { city?: string; district?: string; address?: string; note?: string };
  items?: Array<{ productId?: string; quantity?: number }>;
  expectedTotal?: number;
};

const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  let body: CheckoutBody;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Données de commande invalides." }, { status: 400 }); }
  const name = text(body.customer?.name, 120);
  const email = text(body.customer?.email, 254);
  const enteredPhone = text(body.customer?.phone, 32);
  const phoneDigits = enteredPhone.replace(/[\s().-]/g, "");
  const phone = /^0\d{9}$/.test(phoneDigits) ? `+225${phoneDigits.slice(1)}` : /^225\d{10}$/.test(phoneDigits) ? `+${phoneDigits}` : phoneDigits;
  const city = text(body.shipping?.city, 80);
  const deliveryFee = getDeliveryFeeXof(city);
  const district = text(body.shipping?.district, 120);
  const address = text(body.shipping?.address, 240);
  const note = text(body.shipping?.note, 300);
  const items = Array.isArray(body.items) ? body.items : [];
  if (name.length < 2 || !/^\+[1-9]\d{7,14}$/.test(phone) || !city || district.length < 2 || address.length < 5 || items.length < 1 || items.length > 30 || (email && !/^\S+@\S+\.\S+$/.test(email))) {
    return NextResponse.json({ error: "Vérifiez vos coordonnées, votre adresse et les articles choisis." }, { status: 400 });
  }
  if (deliveryFee === null) return NextResponse.json({ error: "Les frais de livraison pour cette ville restent à définir. Aucun paiement ne peut être lancé pour le moment." }, { status: 422 });

  const db = createAdminClient();
  const apiKey = process.env.GENIUSPAY_API_KEY;
  const apiSecret = process.env.GENIUSPAY_API_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const sandboxPaymentReady = isGeniusPaySandboxConfigured({ apiKey, apiSecret, webhookSecret: process.env.GENIUSPAY_WEBHOOK_SECRET, siteUrl });
  if (!db || !apiKey || !apiSecret || !siteUrl || !sandboxPaymentReady) {
    return NextResponse.json({ error: "Paiement de test non configure : cles sandbox, secret webhook et URL HTTPS requis. Aucune commande ni aucun paiement n'a ete cree." }, { status: 503 });
  }
  const quantities = new Map<string, number>();
  for (const item of items) {
    if (typeof item.productId !== "string" || !Number.isInteger(item.quantity) || (item.quantity ?? 0) < 1 || (item.quantity ?? 0) > 20) return NextResponse.json({ error: "Une quantité d’article n’est pas valide." }, { status: 400 });
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity!);
  }
  const productIds = [...quantities.keys()];
  const { data: catalog, error: catalogError } = await db.from("products").select("id,name,price_xof,stock,is_available").in("id", productIds);
  if (catalogError) return NextResponse.json({ error: "Le catalogue n’est pas disponible. Réessayez plus tard." }, { status: 503 });
  if (!catalog || catalog.length !== productIds.length || catalog.some((item) => !item.is_available || item.stock < (quantities.get(item.id) ?? 0))) {
    return NextResponse.json({ error: "Un article n’est plus disponible dans la quantité demandée." }, { status: 409 });
  }
  const orderItems = catalog.map((item) => ({ product_id: item.id, name: item.name, quantity: quantities.get(item.id)!, unit_price_xof: item.price_xof }));
  const productTotal = orderItems.reduce((sum, item) => sum + item.quantity * item.unit_price_xof, 0);
  const total = calculateGrandTotal(productTotal, deliveryFee);
  if (!Number.isSafeInteger(body.expectedTotal) || body.expectedTotal !== total) {
    return NextResponse.json({ error: "Le total du panier a changé. Actualisez la boutique avant de continuer; aucun paiement n’a été lancé." }, { status: 409 });
  }
  if (!Number.isSafeInteger(total) || total < 200) return NextResponse.json({ error: "Le montant minimum accepté par GeniusPay est de 200 FCFA." }, { status: 400 });

  const orderId = crypto.randomUUID();
  const { error: insertError } = await db.from("orders").insert({
    id: orderId, customer_name: name, customer_email: email || null, customer_phone: phone,
    shipping_city: city, shipping_district: district, shipping_address: address, customer_note: note || null,
    items: orderItems, product_total_xof: productTotal, delivery_fee_xof: deliveryFee, total_xof: total, order_status: "awaiting_payment", payment_status: "pending",
  });
  if (insertError) return NextResponse.json({ error: "La commande n’a pas pu être enregistrée. Aucun paiement n’a été lancé." }, { status: 503 });

  let paymentResponse: Response;
  try {
    paymentResponse = await fetch("https://geniuspay.ci/api/v1/merchant/payments", {
      method: "POST", headers: { "X-API-Key": apiKey, "X-API-Secret": apiSecret, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: total, currency: "XOF", description: `Commande Zayna Africa ${orderId}`, customer: { name, email: email || undefined, phone, country: "CI" }, success_url: `${siteUrl}/?payment=return`, error_url: `${siteUrl}/?payment=return`, metadata: { order_id: orderId } }),
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
  } catch {
    await db.from("orders").update({ payment_status: "initialization_failed" }).eq("id", orderId);
    return NextResponse.json({ error: "GeniusPay est momentanément injoignable. Aucun paiement n’a été confirmé." }, { status: 502 });
  }
  const result = await paymentResponse.json().catch(() => null);
  const payment = result?.data;
  const checkoutUrl = typeof payment?.checkout_url === "string" ? payment.checkout_url : typeof payment?.payment_url === "string" ? payment.payment_url : null;
  if (!paymentResponse.ok || !result?.success || !payment || !isValidSandboxCheckoutResponse(payment, total) || !checkoutUrl) {
    await db.from("orders").update({ payment_status: "initialization_failed" }).eq("id", orderId);
    return NextResponse.json({ error: "GeniusPay n’a pas fourni de lien de paiement. Aucun paiement n’a été confirmé." }, { status: 502 });
  }
  const { error: updateError } = await db.from("orders").update({ geniuspay_reference: payment.reference ?? null }).eq("id", orderId);
  if (updateError) return NextResponse.json({ error: "Le paiement a été préparé mais sa référence n’a pas pu être enregistrée. Contactez la boutique avant de réessayer." }, { status: 503 });
  return NextResponse.json({ checkoutUrl }, { status: 200 });
}
