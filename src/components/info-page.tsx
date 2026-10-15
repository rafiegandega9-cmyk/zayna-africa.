import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

export function InfoLayout({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <main className="info-page"><header className="detail-header"><Link className="text-link" href="/"><ArrowLeft size={15} /> Boutique</Link><Link className="wordmark" href="/">ZAYNA<span>AFRICA</span></Link><span>LA BEAUTÉ DE NOS ORIGINES</span></header><article className="info-content"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children}<Link className="text-link" href="/#collection">Découvrir la collection <ArrowRight size={15} /></Link></article><footer className="info-footer">© 2026 Zayna Africa · Côte d’Ivoire</footer></main>;
}
