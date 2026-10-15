import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateProductEditableFields } from "@/lib/admin-products";

export const runtime = "nodejs";

async function authorized() {
  const auth = await createSupabaseServerClient();
  if (!auth) return false;
  const { data: { user } } = await auth.auth.getUser();
  return user?.app_metadata?.role === "admin";
}

export async function GET() {
  if (!await authorized()) return NextResponse.json({ error: "Accès administrateur requis." }, { status: 401 });
  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: "Supabase n’est pas configuré." }, { status: 503 });
  const [productsResult, ordersResult] = await Promise.all([
    db.from("products").select("id,name,description,slug,image_url,price_xof,stock,is_available,updated_at").order("name"),
    db.from("orders").select("id,customer_name,customer_email,customer_phone,shipping_city,shipping_district,shipping_address,items,total_xof,order_status,payment_status,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  if (productsResult.error || ordersResult.error) return NextResponse.json({ error: "Impossible de charger les données de gestion." }, { status: 503 });
  return NextResponse.json({ products: productsResult.data, orders: ordersResult.data });
}

export async function PATCH(request: Request) {
  if (!await authorized()) return NextResponse.json({ error: "Accès administrateur requis." }, { status: 401 });
  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: "Supabase n’est pas configuré." }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  if (body.type === "product" && typeof body.id === "string") {
    const validated = validateProductEditableFields(body);
    if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: 400 });
    const updates = { ...validated.updates, updated_at: new Date().toISOString() };
    if (updates.image_url !== undefined) {
      const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      try {
        const imageUrl = new URL(updates.image_url);
        if (!projectUrl || imageUrl.origin !== new URL(projectUrl).origin || !imageUrl.pathname.startsWith("/storage/v1/object/public/zayna-products/")) return NextResponse.json({ error: "Image must come from Zayna storage." }, { status: 400 });
        updates.image_url = imageUrl.toString();
      } catch { return NextResponse.json({ error: "Invalid image URL." }, { status: 400 }); }
    }
    const { error } = await db.from("products").update(updates).eq("id", body.id);
    if (error) return NextResponse.json({ error: "Product update failed." }, { status: 503 });
    return NextResponse.json({ saved: true });
  }

  const orderStatuses = ["awaiting_payment", "processing", "preparing", "shipped", "delivered", "cancelled", "payment_failed"];
  if (body.type === "order" && typeof body.id === "string" && orderStatuses.includes(body.order_status)) {
    const { error } = await db.from("orders").update({ order_status: body.order_status, updated_at: new Date().toISOString() }).eq("id", body.id);
    if (error) return NextResponse.json({ error: "La mise à jour de la commande a échoué." }, { status: 503 });
    return NextResponse.json({ saved: true });
  }
  return NextResponse.json({ error: "Modification non autorisée." }, { status: 400 });
}
