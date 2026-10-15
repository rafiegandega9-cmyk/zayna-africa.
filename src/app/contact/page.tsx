import { InfoLayout } from "@/components/info-page";

export const metadata = { title: "Contact — Zayna Africa" };

export default function ContactPage() { return <InfoLayout eyebrow="PARLONS BEAUTÉ" title="Nous sommes à votre écoute."><p>Une question sur un rituel, un produit ou votre commande ? Écrivez à l’équipe Zayna Africa.</p><a className="contact-mail" href="mailto:bonjour@zayna.africa">bonjour@zayna.africa</a><p className="draft-note">Adresse de contact proposée, à confirmer avant publication.</p></InfoLayout>; }
