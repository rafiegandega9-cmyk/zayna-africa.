import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Identifiant de commande invalide." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: "Vérification de commande indisponible." }, { status: 503, headers: { "Cache-Control": "no-store" } });

  const { data, error } = await db.from("orders").select("payment_status").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "Vérification de commande indisponible." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!data) return NextResponse.json({ error: "Commande introuvable." }, { status: 404, headers: { "Cache-Control": "no-store" } });

  return NextResponse.json({ paymentStatus: data.payment_status }, { headers: { "Cache-Control": "no-store" } });
}
