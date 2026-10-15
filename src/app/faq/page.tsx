import { InfoLayout } from "@/components/info-page";

export const metadata = { title: "Questions fréquentes — Zayna Africa" };
const questions = [
  ["Où livrez-vous ?", "Zayna Africa est pensée pour la Côte d’Ivoire. Les villes desservies, délais et frais doivent être confirmés par l’équipe avant l’ouverture des commandes."],
  ["Comment payer ?", "Le paiement sera proposé via la page sécurisée GeniusPay (moyens disponibles selon la configuration du compte marchand). La commande n’est marquée payée qu’après confirmation vérifiée."],
  ["Puis-je modifier une commande ?", "Contactez-nous rapidement avec votre référence. Les modalités de modification et de retour restent à valider par la boutique avant sa mise en service."],
  ["Comment choisir un soin ?", "Les fiches produits décrivent les soins. Les ingrédients, précautions et conseils définitifs doivent être validés à partir des informations fournies par la marque."],
];

export default function FAQPage() { return <InfoLayout eyebrow="À VOTRE ÉCOUTE" title="Questions fréquentes."><div className="info-faq">{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div><h2 id="livraison">Livraison & retours</h2><p>Les conditions de livraison et de retour sont en cours de validation pour la boutique Zayna Africa. Elles seront publiées avant l’acceptation des commandes.</p></InfoLayout>; }
