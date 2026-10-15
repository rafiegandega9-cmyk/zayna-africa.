"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/products";

export function DetailCartButton({ product }: { product: Product }) {
  const [added, setAdded] = useState(false);
  const router = useRouter();
  function add() {
    let cart: { id: string; quantity: number }[] = [];
    try { cart = JSON.parse(localStorage.getItem("zayna-cart") ?? "[]"); } catch { cart = []; }
    const existing = cart.find((line) => line.id === product.id);
    if (existing) existing.quantity += 1;
    else cart.push({ id: product.id, quantity: 1 });
    localStorage.setItem("zayna-cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("zayna-cart-updated"));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  }
  return <div className="detail-buy"><button className="button button-dark" onClick={add}>{added ? "Ajouté au panier" : "Ajouter au panier"}{added ? <Check size={16} /> : <ArrowRight size={16} />}</button><button className="detail-cart-link" onClick={() => router.push("/#collection")}>Continuer mes achats</button></div>;
}
