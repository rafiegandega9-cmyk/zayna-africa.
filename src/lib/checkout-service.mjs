import { calculateGrandTotal } from "./cart.ts";
import { getDeliveryFeeXof } from "./delivery.ts";
import { getSandboxCheckoutUrl, isGeniusPaySandboxConfigured } from "./geniuspay-config.ts";

const text = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";

const response = (status, body) => ({ status, body });

export async function handleCheckoutRequest(body, dependencies) {
  if (!body || typeof body !== "object") return response(400, { error: "Données de commande invalides." });

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
    return response(400, { error: "Vérifiez vos coordonnées, votre adresse et les articles choisis." });
  }
  if (deliveryFee === null) return response(422, { error: "Les frais de livraison pour cette ville restent à définir. Aucun paiement ne peut être lancé pour le moment." });

  const { repository, apiKey, apiSecret, webhookSecret, siteUrl, paymentFetch = fetch } = dependencies;
  const logProviderIssue = dependencies.logProviderIssue ?? ((details) => console.error("GeniusPay checkout initialization rejected", details));
  const sandboxPaymentReady = isGeniusPaySandboxConfigured({ apiKey, apiSecret, webhookSecret, siteUrl });
  if (!repository || !apiKey || !apiSecret || !siteUrl || !sandboxPaymentReady) {
    return response(503, { error: "Paiement de test non configuré : clés sandbox, secret webhook et URL HTTPS requis. Aucune commande ni aucun paiement n'a été créé." });
  }

  const quantities = new Map();
  for (const item of items) {
    if (typeof item.productId !== "string" || !Number.isInteger(item.quantity) || (item.quantity ?? 0) < 1 || (item.quantity ?? 0) > 20) return response(400, { error: "Une quantité d’article n’est pas valide." });
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  const productIds = [...quantities.keys()];
  const { data: catalog, error: catalogError } = await repository.getProducts(productIds);
  if (catalogError) return response(503, { error: "Le catalogue n’est pas disponible. Réessayez plus tard." });
  if (!catalog || catalog.length !== productIds.length || catalog.some((item) => !item.is_available || item.stock < (quantities.get(item.id) ?? 0))) {
    return response(409, { error: "Un article n’est plus disponible dans la quantité demandée." });
  }

  const orderItems = catalog.map((item) => ({ product_id: item.id, name: item.name, quantity: quantities.get(item.id), unit_price_xof: item.price_xof }));
  const productTotal = orderItems.reduce((sum, item) => sum + item.quantity * item.unit_price_xof, 0);
  const total = calculateGrandTotal(productTotal, deliveryFee);
  if (!Number.isSafeInteger(body.expectedTotal) || body.expectedTotal !== total) {
    return response(409, {
      code: "PRICE_CHANGED",
      error: "Les prix du catalogue ont changé. Vérifiez le nouveau total puis confirmez à nouveau; aucun paiement n’a été lancé.",
      quote: {
        items: orderItems.map((item) => ({ productId: item.product_id, unitPriceXof: item.unit_price_xof })),
        productTotalXof: productTotal,
        deliveryFeeXof: deliveryFee,
        totalXof: total,
      },
    });
  }
  if (!Number.isSafeInteger(total) || total < 200) return response(400, { error: "Le montant minimum accepté par GeniusPay est de 200 FCFA." });

  const orderId = crypto.randomUUID();
  const order = {
    id: orderId, customer_name: name, customer_email: email || null, customer_phone: phone,
    shipping_city: city, shipping_district: district, shipping_address: address, customer_note: note || null,
    items: orderItems, product_total_xof: productTotal, delivery_fee_xof: deliveryFee, total_xof: total, order_status: "awaiting_payment", payment_status: "pending",
  };
  const { error: insertError } = await repository.createOrder(order);
  if (insertError) return response(503, { error: "La commande n’a pas pu être enregistrée. Aucun paiement n’a été lancé." });

  let paymentResponse;
  try {
    paymentResponse = await paymentFetch("https://geniuspay.ci/api/v1/merchant/payments", {
      method: "POST", headers: { "X-API-Key": apiKey, "X-API-Secret": apiSecret, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: total, currency: "XOF", description: `Commande Zayna Africa ${orderId}`, customer: { name, email: email || undefined, phone, country: "CI" }, success_url: `${siteUrl}/?payment=return`, error_url: `${siteUrl}/?payment=return`, metadata: { order_id: orderId } }),
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
  } catch {
    await repository.markInitializationFailed(orderId);
    return response(502, { error: "GeniusPay est momentanément injoignable. Aucun paiement n’a été confirmé." });
  }

  const result = await paymentResponse.json().catch(() => null);
  const payment = result?.data;
  if (!paymentResponse.ok || !result?.success || !payment || typeof payment !== "object") {
    logProviderIssue({ httpStatus: paymentResponse.status, providerAccepted: result?.success === true, responseDataPresent: Boolean(payment) });
    await repository.markInitializationFailed(orderId);
    const reason = paymentResponse.status === 401 || paymentResponse.status === 403
      ? `GeniusPay a refusé l’authentification Sandbox (HTTP ${paymentResponse.status}). Vérifiez les identifiants de l’environnement dans Vercel.`
      : `GeniusPay a refusé la demande de paiement (HTTP ${paymentResponse.status}). Aucun paiement n’a été confirmé.`;
    return response(502, { error: reason });
  }
  const checkout = getSandboxCheckoutUrl(payment, total);
  if (!checkout.url) {
    logProviderIssue({ httpStatus: paymentResponse.status, providerAccepted: true, reason: checkout.reason });
    await repository.markInitializationFailed(orderId);
    return response(502, { error: "La réponse GeniusPay ne contient pas un lien de checkout Sandbox valide. Aucun paiement n’a été confirmé." });
  }
  const { error: updateError } = await repository.savePaymentReference(orderId, payment.reference ?? null);
  if (updateError) return response(503, { error: "Le paiement a été préparé mais sa référence n’a pas pu être enregistrée. Contactez la boutique avant de réessayer." });
  return response(200, { checkoutUrl: checkout.url });
}
