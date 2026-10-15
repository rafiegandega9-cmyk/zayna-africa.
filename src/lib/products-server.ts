import { createSupabaseServerClient } from "@/lib/supabase/server";
import { products as previewProducts, type Product } from "@/lib/products";

export async function getPublicCatalog(): Promise<{ products: Product[]; preview: boolean; unavailable: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { products: previewProducts, preview: true, unavailable: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { products: [], preview: false, unavailable: true };
  const { data, error } = await supabase.from("products").select("id,slug,name,category,description,image_url,size_label,image_tone,tagline,price_xof").eq("is_available", true).order("name");
  if (error || !data) return { products: [], preview: false, unavailable: true };
  return { products: data.map((row) => ({ id: row.id, slug: row.slug, name: row.slug === "huile-de-baobab" ? "Huile de fenugrec" : row.name, category: row.category, description: row.description, image: row.image_url, size: row.size_label, tone: row.image_tone, tag: row.tagline ?? undefined, price: row.price_xof })), preview: false, unavailable: false };
}
