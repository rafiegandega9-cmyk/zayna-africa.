import { createHmac, timingSafeEqual } from "node:crypto";

const response = (status, body) => ({ status, body });

export async function handleGeniusPayWebhook({ secret, repository, rawBody, timestamp, signature, environment, eventHeader, nowSeconds = Date.now() / 1000 }) {
  if (!secret || !repository) return response(503, { error: "Webhook non configuré." });
  const seconds = Number(timestamp);
  if (!/^\d{10,}$/.test(timestamp) || !Number.isFinite(seconds) || Math.abs(nowSeconds - seconds) > 300) return response(400, { error: "Timestamp webhook invalide." });
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  let actual;
  try { actual = Buffer.from(signature, "hex"); } catch { return response(401, { error: "Signature invalide." }); }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return response(401, { error: "Signature invalide." });

  let payload;
  try { payload = JSON.parse(rawBody); } catch { return response(400, { error: "Payload invalide." }); }
  if (environment !== "sandbox" || payload.environment !== "sandbox") return response(403, { error: "Seuls les webhooks sandbox sont acceptés pour cette démonstration." });
  if (eventHeader && payload.event && eventHeader !== payload.event) return response(400, { error: "Événement webhook incohérent." });
  const event = payload.event ?? eventHeader;
  const orderId = payload.data?.metadata?.order_id;
  if (!orderId || !payload.data?.reference || !Number.isFinite(payload.data.amount)) return response(400, { error: "Données de paiement manquantes." });

  const { data: order, error } = await repository.getOrder(orderId);
  if (error) return response(503, { error: "Vérification de commande impossible." });
  if (!order || order.total_xof !== payload.data.amount || payload.data.currency !== "XOF" || (order.geniuspay_reference && order.geniuspay_reference !== payload.data.reference)) {
    return response(409, { error: "La commande ne correspond pas au paiement." });
  }
  const completed = event === "payment.success" && payload.data.status === "completed";
  const failed = ["payment.failed", "payment.cancelled", "payment.expired"].includes(event ?? "");
  if (!completed && !failed) return response(200, { received: true });
  if (order.payment_status === "paid") return response(200, { received: true });

  const update = {
    payment_status: completed ? "paid" : "failed",
    order_status: completed ? "processing" : "payment_failed",
    geniuspay_reference: payload.data.reference,
  };
  const { data: updatedOrder, error: updateError } = await repository.updateUnpaidOrder(orderId, update);
  if (updateError) return response(503, { error: "Mise à jour de commande impossible." });
  if (!updatedOrder) return response(200, { received: true });
  return response(200, { received: true });
}
