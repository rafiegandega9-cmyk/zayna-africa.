"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, LogOut, RefreshCw, Save } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatPrice } from "@/lib/products";

type ProductRow = { id: string; name: string; description: string; image_url: string; price_xof: number; stock: number; is_available: boolean; updated_at: string };
type OrderRow = { id: string; customer_name: string; customer_email: string | null; customer_phone: string; shipping_city: string; shipping_district: string; shipping_address: string; items: { name: string; quantity: number }[]; total_xof: number; order_status: string; payment_status: string; created_at: string };
const statuses = ["awaiting_payment", "processing", "preparing", "shipped", "delivered", "cancelled", "payment_failed"];

export default function AdminPanel() {
  const client = createSupabaseBrowserClient();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [signedIn, setSignedIn] = useState(false); const [products, setProducts] = useState<ProductRow[]>([]); const [orders, setOrders] = useState<OrderRow[]>([]);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");

  async function loadData() {
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/admin", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setProducts(data.products); setOrders(data.orders); setSignedIn(true); }
    catch (error) { setSignedIn(false); setMessage(error instanceof Error ? error.message : "Connexion requise."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!client) return;
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [client]);

  async function signIn(event: FormEvent) {
    event.preventDefault(); if (!client) return; setBusy(true); setMessage("");
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) { setMessage("Connexion impossible. Vérifiez vos identifiants et la configuration Supabase."); setBusy(false); return; }
    await loadData();
  }
  async function save(body: Record<string, unknown>) {
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({})); setBusy(false);
    setMessage(response.ok ? "Modification enregistrée." : result.error || "Enregistrement impossible.");
    if (response.ok) await loadData();
  }
  async function signOut() { await client?.auth.signOut(); setSignedIn(false); setProducts([]); setOrders([]); }

  return <main className="admin-page"><header className="admin-header"><Link className="text-link" href="/"><ArrowLeft size={15} /> Retour à la boutique</Link><Link className="wordmark" href="/">ZAYNA<span>AFRICA</span></Link>{signedIn ? <button className="admin-action" onClick={signOut}><LogOut size={14} /> Déconnexion</button> : <span />}</header>
    {!signedIn ? <section className="admin-login"><p className="eyebrow">ESPACE PRIVÉ</p><h1>Administration</h1><p>Connectez-vous avec un compte Supabase autorisé par l’équipe.</p><form onSubmit={signIn}><label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label><label>Mot de passe<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label><button className="button button-dark full" disabled={busy || !client}>{busy ? "Connexion…" : "Se connecter"}</button></form>{(message || (!client ? "Renseignez les variables Supabase pour activer l’espace administrateur." : "")) && <p className="admin-message" role="status">{message || "Renseignez les variables Supabase pour activer l’espace administrateur."}</p>}</section> : <section className="admin-content"><div className="admin-title"><div><p className="eyebrow">ESPACE PRIVÉ</p><h1>Bonjour, Zayna.</h1></div><button className="admin-action" onClick={() => void loadData()} disabled={busy}><RefreshCw size={14} /> Actualiser</button></div>{message && <p className="admin-message" role="status">{message}</p>}<h2>Catalogue <span>{products.length}</span></h2><div className="admin-table-wrap"><table><thead><tr><th>Nom</th><th>Description</th><th>Image</th><th>Prix (FCFA)</th><th>Stock</th><th>Disponible</th><th /></tr></thead><tbody>{products.map((p) => <ProductEditor key={`${p.id}-${p.updated_at}`} product={p} onSave={save} busy={busy} onNotice={setMessage} />)}</tbody></table>{!products.length && <p className="admin-empty">Aucun produit en base. Appliquez la migration et renseignez le catalogue validé.</p>}</div><h2 className="orders-title">Commandes <span>{orders.length}</span></h2><div className="order-admin-list">{orders.map((order) => <article className="order-admin-card" key={order.id}><div className="order-admin-head"><div><strong>{order.customer_name}</strong><span>{new Date(order.created_at).toLocaleString("fr-FR")}</span></div><div className="order-total">{formatPrice(order.total_xof)}<small>Paiement : {order.payment_status}</small></div></div><p>{order.customer_phone} · {order.shipping_district}, {order.shipping_city} · {order.shipping_address}</p><p>{(order.items ?? []).map((item) => `${item.name} × ${item.quantity}`).join(" · ")}</p><label className="status-label">État de la commande<select value={order.order_status} onChange={(e) => void save({ type: "order", id: order.id, order_status: e.target.value })}>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label></article>)}{!orders.length && <p className="admin-empty">Aucune commande enregistrée.</p>}</div></section>}
  </main>;
}

function ProductEditor({ product, onSave, busy, onNotice }: { product: ProductRow; onSave: (body: Record<string, unknown>) => Promise<void>; busy: boolean; onNotice: (message: string) => void }) {
  const nameRef = useRef<HTMLInputElement>(null); const descriptionRef = useRef<HTMLTextAreaElement>(null); const priceRef = useRef<HTMLInputElement>(null); const stockRef = useRef<HTMLInputElement>(null); const availableRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  async function uploadImage(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { onNotice("Choisissez une image JPG, PNG ou WebP de 5 Mo maximum."); return; }
    const client = createSupabaseBrowserClient();
    if (!client) { onNotice("Supabase n’est pas configuré."); return; }
    setUploading(true); onNotice("");
    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const path = `${product.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await client.storage.from("zayna-products").upload(path, file, { contentType: file.type, upsert: false });
    if (error) { onNotice("Envoi de l’image impossible. Vérifiez le rôle administrateur et le bucket Storage."); setUploading(false); return; }
    const { data } = client.storage.from("zayna-products").getPublicUrl(path);
    await onSave({ type: "product", id: product.id, image_url: data.publicUrl });
    setUploading(false);
  }
  return <tr><td><input aria-label="Nom du produit" type="text" maxLength={120} defaultValue={product.name} ref={nameRef} /></td><td><textarea aria-label="Description du produit" maxLength={2000} rows={3} defaultValue={product.description} ref={descriptionRef} /></td><td><label className="image-upload">{uploading ? "Envoi…" : "Choisir une photo"}<input aria-label={`Photo de ${product.name}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadImage(event.target.files?.[0])} disabled={busy || uploading} /></label></td><td><input aria-label={`Prix de ${product.name}`} type="number" min="0" defaultValue={product.price_xof} ref={priceRef} /></td><td><input aria-label={`Stock de ${product.name}`} type="number" min="0" defaultValue={product.stock} ref={stockRef} /></td><td><input aria-label={`Disponibilité de ${product.name}`} type="checkbox" defaultChecked={product.is_available} ref={availableRef} /></td><td><button className="save-button" disabled={busy} onClick={() => void onSave({ type: "product", id: product.id, name: nameRef.current?.value, description: descriptionRef.current?.value, price_xof: Number(priceRef.current?.value), stock: Number(stockRef.current?.value), is_available: availableRef.current?.checked })}><Save size={13} /> Enregistrer</button></td></tr>;
}
