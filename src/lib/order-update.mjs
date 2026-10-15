const orderStatuses = ["awaiting_payment", "processing", "preparing", "shipped", "delivered", "cancelled", "payment_failed"];

export function getAdminOrderUpdate(body, updatedAt = new Date().toISOString()) {
  if (!body || body.type !== "order" || typeof body.id !== "string" || !orderStatuses.includes(body.order_status)) return null;
  return { id: body.id, updates: { order_status: body.order_status, updated_at: updatedAt } };
}
