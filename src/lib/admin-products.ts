export type ProductEditableFields = {
  name?: string;
  description?: string;
  price_xof?: number;
  stock?: number;
  is_available?: boolean;
  image_url?: string;
};

type ValidationResult = { updates: ProductEditableFields } | { error: string };

export function validateProductEditableFields(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Données produit invalides." };
  }

  const body = input as Record<string, unknown>;
  const updates: ProductEditableFields = {};

  if (Object.hasOwn(body, "name")) {
    if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 120) {
      return { error: "Le nom doit contenir entre 2 et 120 caractères." };
    }
    updates.name = body.name.trim();
  }
  if (Object.hasOwn(body, "description")) {
    if (typeof body.description !== "string" || body.description.length > 2000) {
      return { error: "La description ne peut pas dépasser 2 000 caractères." };
    }
    updates.description = body.description.trim();
  }
  if (Object.hasOwn(body, "price_xof")) {
    if (!Number.isInteger(body.price_xof) || (body.price_xof as number) < 0 || (body.price_xof as number) > 100_000_000) {
      return { error: "Le prix doit être un montant entier valide en FCFA." };
    }
    updates.price_xof = body.price_xof as number;
  }
  if (Object.hasOwn(body, "stock")) {
    if (!Number.isInteger(body.stock) || (body.stock as number) < 0 || (body.stock as number) > 100_000) {
      return { error: "Le stock doit être un entier compris entre 0 et 100 000." };
    }
    updates.stock = body.stock as number;
  }
  if (Object.hasOwn(body, "is_available")) {
    if (typeof body.is_available !== "boolean") return { error: "La disponibilité doit être activée ou désactivée." };
    updates.is_available = body.is_available;
  }
  if (Object.hasOwn(body, "image_url")) {
    if (typeof body.image_url !== "string" || body.image_url.length > 2048) return { error: "L’adresse de l’image est invalide." };
    updates.image_url = body.image_url;
  }

  if (!Object.keys(updates).length) return { error: "Aucune modification de produit valide." };
  return { updates };
}
