import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Leaf } from "lucide-react";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/products";
import { getPublicCatalog } from "@/lib/products-server";
import { DetailCartButton } from "@/components/detail-cart-button";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = await getPublicCatalog();
  const product = catalog.products.find((item) => item.slug === slug);
  if (!product) notFound();
  return <main className="detail-page"><header className="detail-header"><Link href="/#collection" className="text-link"><ArrowLeft size={15} /> Retour à la collection</Link><Link className="wordmark" href="/">ZAYNA<span>AFRICA</span></Link><span>LA BEAUTÉ DE NOS ORIGINES</span></header><div className="detail-grid"><div className="detail-visual" style={{ backgroundColor: product.tone }}><Image src={product.image} alt={product.name} fill sizes="(max-width: 760px) 100vw, 50vw" priority /></div><div className="detail-copy"><p className="eyebrow">{product.category.toUpperCase()} · {product.size}</p><h1>{product.name}</h1><p className="detail-price">{formatPrice(product.price)}</p><p className="detail-desc">{product.description}</p><div className="detail-benefit"><Leaf size={16} /><span>Un soin inspiré des rituels naturels et des savoir-faire transmis.</span></div>{catalog.preview && <p className="draft-note">Les informations et tarifs affichés sont à valider avec le catalogue réel de la marque.</p>}<DetailCartButton product={product} /><div className="detail-extra"><details><summary>Conseils d’utilisation</summary><p>Adoptez ce soin dans votre rituel habituel. Les conseils détaillés seront ajoutés avec les informations finales du produit.</p></details><details><summary>Livraison en Côte d’Ivoire</summary><p>Les délais et frais dépendent de votre ville et seront confirmés avant le paiement.</p></details></div></div></div></main>;
}
