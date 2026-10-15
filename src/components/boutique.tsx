"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Leaf, Menu, Minus, Plus, Search, ShoppingBag, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatPrice, type Product } from "@/lib/products";
import { calculateCartLines, calculateCartTotal, calculateGrandTotal, parseStoredCart, type CartLine } from "@/lib/cart";
import { getDeliveryFeeXof } from "@/lib/delivery";
import { getProductPresentationImage, isProductIllustrativePhoto } from "@/lib/product-artwork";

const categories = ["Tout voir", "Rituel hammam", "Huiles précieuses"];
const categoryTiles = [
  { name: "Rituel hammam", detail: "Des gestes de soin inspirés des traditions", image: "/images/products/savons-naturels.png", alt: "Savons naturels Zayna présentés ensemble" },
  { name: "Huiles précieuses", detail: "Des huiles végétales au cœur du rituel", image: "/images/ingredients/argan-oil-public-domain.jpg", alt: "Photo illustrative d’huile d’argan" },
];

export default function Boutique({ products, previewCatalog, catalogUnavailable, sandboxPaymentReady }: { products: Product[]; previewCatalog: boolean; catalogUnavailable: boolean; sandboxPaymentReady: boolean }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Tout voir");
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [shippingCity, setShippingCity] = useState("Abidjan");
  const [catalogPriceOverrides, setCatalogPriceOverrides] = useState<Record<string, number>>({});
  const [cartHydrated, setCartHydrated] = useState(false);

  useEffect(() => {
    const syncCart = () => {
      setCart(parseStoredCart(localStorage.getItem("zayna-cart")));
      setCartHydrated(true);
    };
    window.addEventListener("zayna-cart-updated", syncCart);
    window.addEventListener("storage", syncCart);
    syncCart();
    return () => {
      window.removeEventListener("zayna-cart-updated", syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);
  useEffect(() => {
    if (cartHydrated) localStorage.setItem("zayna-cart", JSON.stringify(cart));
  }, [cart, cartHydrated]);

  const visibleProducts = products.filter((product) => {
    const matchesCategory = activeCategory === "Tout voir" || product.category === activeCategory;
    const query = searchQuery.trim().toLocaleLowerCase("fr");
    const matchesSearch = !query || `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase("fr").includes(query);
    return matchesCategory && matchesSearch;
  });
  const pricedProducts = useMemo(() => products.map((product) => catalogPriceOverrides[product.id] === undefined
    ? product
    : { ...product, price: catalogPriceOverrides[product.id] }), [catalogPriceOverrides, products]);
  const cartDetails = useMemo(() => calculateCartLines(cart, pricedProducts), [cart, pricedProducts]);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const total = calculateCartTotal(cartDetails);
  const deliveryFeeXof = getDeliveryFeeXof(shippingCity);
  const payableTotal = deliveryFeeXof === null ? null : calculateGrandTotal(total, deliveryFeeXof);

  function addToCart(product: Product) {
    setCart((current) => current.some((line) => line.id === product.id)
      ? current.map((line) => line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
      : [...current, { id: product.id, quantity: 1 }]);
    setNotice(`${product.name} ajouté au panier`);
    window.setTimeout(() => setNotice(""), 2500);
  }

  function updateQuantity(id: string, delta: number) {
    setCart((current) => current.map((line) => line.id === id ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0));
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setCheckoutError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        customer: { name: form.get("name"), email: form.get("email"), phone: form.get("phone") },
        shipping: { city: form.get("city"), district: form.get("district"), address: form.get("address"), note: form.get("note") },
        items: cart.map(({ id, quantity }) => ({ productId: id, quantity })),
        expectedTotal: payableTotal,
      }) });
      const result = await response.json();
      if (response.status === 409 && result.code === "PRICE_CHANGED" && Array.isArray(result.quote?.items)
        && Number.isSafeInteger(result.quote.totalXof)) {
        const quotedPrices = Object.fromEntries(result.quote.items
          .filter((item: { productId?: unknown; unitPriceXof?: unknown }) => typeof item.productId === "string"
            && cart.some((line) => line.id === item.productId)
            && Number.isSafeInteger(item.unitPriceXof))
          .map((item: { productId: string; unitPriceXof: number }) => [item.productId, item.unitPriceXof]));
        if (Object.keys(quotedPrices).length === cart.length) {
          setCatalogPriceOverrides((current) => ({ ...current, ...quotedPrices }));
          setCheckoutError(`Le catalogue a été actualisé. Le nouveau total est ${formatPrice(result.quote.totalXof)}. Vérifiez-le puis confirmez à nouveau; aucun paiement n’a été lancé.`);
          return;
        }
      }
      if (!response.ok) throw new Error(result.error || "Le paiement n’a pas pu être préparé.");
      if (typeof result.checkoutUrl !== "string" || !result.checkoutUrl.startsWith("https://")) throw new Error("Lien de paiement non valide reçu.");
      window.location.assign(result.checkoutUrl);
    } catch (error) { setCheckoutError(error instanceof Error ? error.message : "Une erreur est survenue."); }
    finally { setSubmitting(false); }
  }

  return <>
    <div className="announcement"><span>Une beauté enracinée. Des gestes qui ont du sens.</span><a href="#collection">Découvrir la collection <ArrowRight size={13} /></a></div>
    <header className="site-header">
      <button className="icon-button mobile-menu" aria-label="Ouvrir le menu" onClick={() => setMenuOpen(!menuOpen)}><Menu size={20} /></button>
      <Link className="wordmark" href="#top" aria-label="Zayna Africa accueil">ZAYNA<span>AFRICA</span></Link>
      <label className="site-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Rechercher un produit</span><input type="search" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setActiveCategory("Tout voir"); }} onKeyDown={(event) => { if (event.key === "Enter") document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" }); }} placeholder="Rechercher un produit, un soin…" /></label>
      <nav className={menuOpen ? "main-nav open" : "main-nav"} aria-label="Navigation principale">
        <a href="#collection" onClick={() => setMenuOpen(false)}>La collection</a><a href="#histoire" onClick={() => setMenuOpen(false)}>Notre histoire</a><a href="#rituel" onClick={() => setMenuOpen(false)}>Nos rituels</a>
      </nav>
      <button className="bag-button" onClick={() => setCartOpen(true)} aria-label={`Ouvrir le panier, ${cartCount} article(s)`}>Panier <span>{cartCount}</span><ShoppingBag size={17} strokeWidth={1.5} /></button>
    </header>

    <main id="top">
      <section className="hero">
        <Image className="hero-photo" src="/images/hammam-editorial.jpg" alt="Rituel de soin aux matières naturelles" fill priority sizes="100vw" />
        <div className="hero-shade" />
        <div className="hero-copy"><p className="eyebrow light">RITUELS DE BEAUTÉ · AFRIQUE & MAROC</p><h1>La beauté de<br /><em>nos origines.</em></h1><p className="hero-intro">Des gestes transmis, des ingrédients précieux,<br className="desktop-break" /> une beauté qui nous ressemble.</p><a className="button button-cream" href="#collection">Explorer la collection <ArrowRight size={16} /></a></div>
        <div className="hero-note"><span>01 / 03</span><span className="note-line" /><span>Le rituel du hammam</span></div>
        <a className="hero-scroll" href="#collection"><ArrowDown size={15} /> DÉFILER</a>
        <div className="hero-stamp"><span>BEAUTÉ<br />VIVANTE</span><Sparkles size={19} /></div>
      </section>

      <section className="values-strip"><div><Leaf /><span>Ingrédients d’origine naturelle</span></div><i /><div><Sparkles /><span>Inspiré de nos rituels ancestraux</span></div><i /><div><span className="value-ci">CI</span><span>Pensé en Côte d’Ivoire</span></div></section>

      <section className="category-tiles" aria-label="Découvrir par catégorie">{categoryTiles.map((category) => <button className="category-tile" key={category.name} onClick={() => { setActiveCategory(category.name); setSearchQuery(""); document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" }); }}><Image src={category.image} alt={category.alt} fill sizes="(max-width: 680px) 100vw, 50vw" /><span className="category-tile-shade" /><span className="category-tile-copy"><strong>{category.name}</strong><small>{category.detail}</small><em>Voir les soins <ArrowRight size={14} /></em></span></button>)}</section>

      <section id="collection" className="collection section-wrap">
        <div className="section-heading"><div><p className="eyebrow">L’ESSENTIEL ZAYNA</p><h2>Des rituels <em>à soi.</em></h2></div><a className="text-link" href="#rituel">Voir tous nos rituels <ArrowUpRight size={16} /></a></div>
        <div className="collection-toolbar"><p>{catalogUnavailable ? "Le catalogue est momentanément indisponible." : previewCatalog ? "Aperçu de collection — tarifs et informations à confirmer." : "Demonstration pedagogique GoMyCode : prix et stocks fictifs."}</p><div className="filters" aria-label="Filtrer les produits">{categories.map((category) => <button key={category} className={category === activeCategory ? "filter active" : "filter"} onClick={() => setActiveCategory(category)}>{category}</button>)}</div></div>
        {visibleProducts.length ? <div className="product-grid">{visibleProducts.map((product, index) => <ProductCard key={product.id} product={product} index={index} onAdd={() => addToCart(product)} />)}</div> : <p className="admin-empty">{catalogUnavailable ? "Vérifiez la configuration Supabase. Aucun achat ne peut être initié." : searchQuery ? "Aucun soin ne correspond à cette recherche." : activeCategory !== "Tout voir" ? "Cette catégorie sera bientôt enrichie." : "La collection arrive prochainement."}</p>}
      </section>

      <section id="histoire" className="story">
        <div className="story-image"><Image src="/images/ritual-texture.jpg" alt="Matières minérales et soin naturel" fill sizes="(max-width: 800px) 100vw, 50vw" /></div>
        <div className="story-copy"><p className="eyebrow">UNE BEAUTÉ QUI NOUS RELIE</p><h2>Un héritage,<br /><em>à fleur de peau.</em></h2><p>De la chaleur du hammam aux huiles que l’on se transmet, Zayna célèbre les gestes de beauté qui traversent les générations et les frontières.</p><p>Une invitation à ralentir, à prendre soin de soi et à renouer avec ce qui nous est essentiel.</p><a className="text-link" href="#rituel">L’esprit Zayna <ArrowUpRight size={16} /></a><span className="story-mark">Z.</span></div>
      </section>

      <section id="rituel" className="ritual section-wrap"><div className="ritual-copy"><p className="eyebrow">LE RITUEL DU HAMMAM</p><h2>Un instant<br />pour <em>revenir à soi.</em></h2><p>Du savon noir au ghassoul, des huiles d’argan et de baobab au beurre de karité : des matières inspirées de nos rituels, présentées ici en photos d’illustration.</p><a href="#collection" className="button button-dark">Créer mon rituel <ArrowRight size={16} /></a></div><div className="ritual-image"><Image src="/images/hammam-editorial.jpg" alt="Éléments d’un hammam marocain traditionnel, photo d’ambiance" fill sizes="(max-width: 800px) 100vw, 50vw" /><span>LE TEMPS<br />DE SOI</span></div></section>

      <section id="faq" className="faq-section section-wrap"><div><p className="eyebrow">À VOTRE ÉCOUTE</p><h2>Quelques réponses<br /><em>avec soin.</em></h2><Link className="text-link" href="/faq">Toutes les questions <ArrowRight size={15} /></Link></div><div className="faq-list"><details><summary>Où livrez-vous ?</summary><p>La boutique est pensée pour les commandes en Côte d’Ivoire. Les villes, délais et frais seront confirmés lors de la mise en service.</p></details><details><summary>Comment sont confirmés les paiements ?</summary><p>Le règlement sera traité sur la page sécurisée GeniusPay. La confirmation de paiement dépendra du retour officiel de GeniusPay.</p></details><details><summary>Comment choisir un soin ?</summary><p>Chaque fiche présente les informations utiles. Les détails définitifs seront ajoutés à partir du catalogue réel de Zayna.</p></details></div></section>
      <section className="newsletter"><p className="eyebrow light">LES LETTRES DE ZAYNA</p><h2>Un peu de beauté<br /><em>dans votre boîte.</em></h2><p>Des rituels, des histoires et des nouvelles de la maison.</p><form onSubmit={(e) => { e.preventDefault(); setNotice("L’inscription à la lettre sera activée prochainement."); window.setTimeout(() => setNotice(""), 3500); }}><label className="sr-only" htmlFor="newsletter-email">Votre adresse e-mail</label><input id="newsletter-email" type="email" placeholder="Votre adresse e-mail" required /><button aria-label="S’inscrire à la lettre" type="submit"><ArrowRight /></button></form><small>Une lettre de temps en temps, rien de plus.</small></section>
    </main>

    <footer className="site-footer"><div className="footer-top"><div><Link className="wordmark footer-logo" href="#top">ZAYNA<span>AFRICA</span></Link><p>La beauté de nos origines.</p></div><div className="footer-links"><div><span>EXPLORER</span><a href="#collection">La collection</a><a href="#histoire">Notre histoire</a><a href="#rituel">Nos rituels</a></div><div><span>À VOTRE ÉCOUTE</span><Link href="/contact">Nous contacter</Link><Link href="/faq">Questions fréquentes</Link><Link href="/faq#livraison">Livraison & retours</Link></div></div></div><div className="footer-bottom"><span>© 2026 Zayna Africa</span><span>Fait avec soin en Côte d’Ivoire</span><div><Link href="/confidentialite">Confidentialité</Link><Link href="/conditions">Conditions de vente</Link></div></div></footer>

    {notice && <div className="toast" role="status"><Check size={16} /> {notice}</div>}
    {cartOpen && <><button className="backdrop" aria-label="Fermer le panier" onClick={() => setCartOpen(false)} /><aside className="drawer" aria-label="Votre panier"><div className="drawer-head"><div><p className="eyebrow">VOTRE SÉLECTION</p><h2>Le panier <span>({cartCount})</span></h2></div><button className="icon-button" aria-label="Fermer" onClick={() => setCartOpen(false)}><X /></button></div>
      {cartDetails.length ? <><div className="cart-lines">{cartDetails.map(({ product, quantity, unitPrice, subtotal }) => <div className="cart-line" key={product.id}><div className="cart-thumb" style={{ background: product.tone }}><Image src={getProductPresentationImage(product)} alt="" fill sizes="84px" /></div><div className="cart-line-info"><span>{product.category}</span><strong>{product.name}</strong><b>Prix unitaire · {formatPrice(unitPrice)}</b><small>Sous-total · {formatPrice(subtotal)}</small><div className="quantity"><button aria-label="Diminuer la quantité" onClick={() => updateQuantity(product.id, -1)}><Minus size={13} /></button><span>{quantity}</span><button aria-label="Augmenter la quantité" onClick={() => updateQuantity(product.id, 1)}><Plus size={13} /></button></div></div><button className="remove-link" onClick={() => setCart((c) => c.filter((line) => line.id !== product.id))}>Retirer</button></div>)}</div><div className="drawer-total"><p><span>Sous-total produits</span><b>{formatPrice(total)}</b></p><small>Livraison calculée selon la destination choisie</small><button className="button button-dark full" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>Passer commande <ArrowRight size={16} /></button></div></> : <div className="empty-cart"><ShoppingBag size={26} /><p>Votre panier attend son premier rituel.</p><button className="text-link" onClick={() => setCartOpen(false)}>Découvrir les soins <ArrowRight size={15} /></button></div>}</aside></>}

    {checkoutOpen && <><button className="backdrop" aria-label="Fermer la commande" onClick={() => setCheckoutOpen(false)} /><div className="checkout-modal"><div className="drawer-head"><div><p className="eyebrow">DERNIÈRE ÉTAPE</p><h2>Votre commande</h2></div><button className="icon-button" aria-label="Fermer" onClick={() => setCheckoutOpen(false)}><X /></button></div><div className="order-summary">{cartDetails.map(({ product, quantity, unitPrice, subtotal }) => <p key={product.id}><span>{product.name} · {formatPrice(unitPrice)} × {quantity}</span><b>{formatPrice(subtotal)}</b></p>)}<p><span>Sous-total produits</span><b>{formatPrice(total)}</b></p><p><span>Livraison - {shippingCity}</span><b>{deliveryFeeXof === null ? "Livraison indisponible" : formatPrice(deliveryFeeXof)}</b></p>{payableTotal !== null && <p className="summary-total"><span>Total</span><b>{formatPrice(payableTotal)}</b></p>}</div><form className="checkout-form" onSubmit={submitOrder}><label>Nom complet<input name="name" autoComplete="name" required /></label><div className="form-pair"><label>Téléphone<input name="phone" type="tel" autoComplete="tel" placeholder="07 00 00 00 00" required /></label><label>E-mail <small>(facultatif)</small><input name="email" type="email" autoComplete="email" /></label></div><div className="form-pair"><label>Ville<select name="city" value={shippingCity} onChange={(event) => setShippingCity(event.target.value)}><option>Abidjan</option><option>Yamoussoukro</option><option>Bouaké</option><option>San-Pédro</option><option>Autre ville</option></select></label><label>Commune / quartier<input name="district" autoComplete="address-level2" required /></label></div><label>Adresse de livraison<input name="address" autoComplete="street-address" required /></label><label>Indications utiles <small>(facultatif)</small><textarea name="note" rows={2} /></label>{checkoutError && <p role="alert" className="form-error">{checkoutError}</p>}<p className="checkout-hint">{deliveryFeeXof === null ? "La livraison n'est pas encore disponible pour cette ville." : !sandboxPaymentReady ? "Paiement de test a configurer. Aucune commande ne sera enregistree." : `Livraison : ${formatPrice(deliveryFeeXof)}. Paiement via GeniusPay.`}</p><button className="button button-dark full" disabled={submitting || deliveryFeeXof === null || !sandboxPaymentReady}>{submitting ? "Préparation…" : deliveryFeeXof === null ? "Livraison indisponible" : !sandboxPaymentReady ? "Paiement de test a configurer" : `Continuer vers le paiement · ${formatPrice(payableTotal!)}`}<ArrowRight size={16} /></button></form></div></>}
  </>;
}

function ProductCard({ product, index, onAdd }: { product: Product; index: number; onAdd: () => void }) {
  const image = getProductPresentationImage(product);
  const illustrative = isProductIllustrativePhoto(product);
  return <article className="product-card"><Link href={`/produit/${product.slug}`} className="product-visual" style={{ backgroundColor: product.tone }}><Image src={image} alt={illustrative ? `Photo illustrative d’un ingrédient ou d’un geste de soin, sans représenter le produit Zayna exact : ${product.name}` : product.name} fill sizes="(max-width: 650px) 50vw, (max-width: 1000px) 33vw, 25vw" priority={index < 2} /><span className="product-tag">{illustrative ? "PHOTO ILLUSTRATIVE" : product.tag}</span><span className="quick-view">Découvrir <ArrowUpRight size={15} /></span></Link><div className="product-meta"><div><p>{product.category} · {product.size}</p><Link href={`/produit/${product.slug}`} className="product-name">{product.name}</Link></div><span className="product-price">{formatPrice(product.price)}</span></div><button className="add-button" onClick={onAdd}>Ajouter au panier <Plus size={14} /></button></article>;
}
