# ZAYNA AFRICA

Boutique Next.js, TypeScript et Tailwind CSS pour des rituels de beauté inspirés de l’Afrique et du Maroc.

## Démarrage

```bash
npm install
npm run dev
```

La boutique publique lit les produits disponibles dans Supabase. Le catalogue code en dur sert uniquement d apercu si les variables Supabase publiques manquent. Les produits actuellement publies portent des prix et stocks fictifs pour la demonstration GoMyCode; ils ne doivent pas servir a de vraies ventes.

## Préparer Supabase

1. Créez ou sélectionnez le projet Supabase Zayna Africa.
2. Copiez `.env.example` vers `.env.local` et renseignez `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_SECRET_KEY` depuis **Project Settings → API**. La clé secrète Supabase reste uniquement côté serveur.
3. Appliquez `supabase/migrations/20261014184509_store.sql` dans le SQL Editor du projet ciblé. La migration crée les tables `products` et `orders`, active RLS, expose uniquement la lecture des produits publiés et réserve l’accès aux commandes aux routes serveur. Elle crée aussi le bucket public `zayna-products` (images visibles publiquement; écriture, remplacement et suppression réservés aux administrateurs).
4. Les lignes produits de départ sont désactivées (`is_available = false`, stock 0). Validez les tarifs, les descriptions, les photos et le stock réels, puis activez les produits depuis `/admin`.
5. Créez un utilisateur administrateur dans Supabase Auth, puis attribuez-lui côté serveur/dashboard un `app_metadata` contenant `{"role":"admin"}`. N’utilisez pas `user_metadata` pour l’autorisation. Connectez-vous à `/admin` avec cet utilisateur.

## Preparer GeniusPay (sandbox uniquement)

L application autorise uniquement des paiements de test. Le bouton reste indisponible et l API refuse la commande tant que la configuration sandbox complete n est pas presente. Aucune commande n est enregistree dans cet etat.

1. Creez dans GeniusPay une paire de cles sandbox (`pk_sandbox_...` et `sk_sandbox_...`) et stockez-les dans `.env.local`. Les cles live sont refusees par le code de demonstration.
2. Creez un webhook sandbox avec l URL publique HTTPS `https://<votre-domaine>/api/webhooks/geniuspay` et les evenements `payment.success`, `payment.failed`, `payment.cancelled` et `payment.expired`. Stockez le secret `whsec_...` retourne lors de sa creation dans `GENIUSPAY_WEBHOOK_SECRET`.
3. Definissez `NEXT_PUBLIC_SITE_URL` sur cette origine HTTPS et redemarrez Next.js apres toute modification de variable.
4. Le serveur cree un checkout heberge en XOF, et seul un webhook signe, recent, en environnement sandbox, correspondant au montant et a la commande peut confirmer un paiement. Une redirection du navigateur ne marque jamais une commande payee.

Variables requises : `SUPABASE_SECRET_KEY`, `GENIUSPAY_API_KEY`, `GENIUSPAY_API_SECRET`, `GENIUSPAY_WEBHOOK_SECRET` et `NEXT_PUBLIC_SITE_URL`. Les deux cles API doivent etre sandbox et l origine doit etre publique en HTTPS. Les secrets restent cote serveur.

## Avant ouverture commerciale

- Remplacer les quatre fiches de départ par le catalogue réel : ingrédients validés, volume, tarifs, images, précautions et stock.
- Compléter et faire valider les conditions de vente, la notice de confidentialité, les modalités de livraison et le contact officiel.
- Configurer une origine HTTPS, les clés sandbox GeniusPay, le webhook et l’accès administrateur; vérifier le parcours réel en sandbox.
- Les stocks sont contrôlés au démarrage du paiement mais ne sont pas encore réservés/décrémentés de manière transactionnelle lors d’un paiement concurrent. Mettre en place cette réservation avant un volume de ventes réel.

## Vérification locale

```bash
npm run build
```
