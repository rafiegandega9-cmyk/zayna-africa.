import type { Product } from "@/lib/products";

const illustrativePhotos: Record<string, string> = {
  "savon-noir-beldi": "/images/ingredients/savon-noir-editorial-pexels.jpg",
  "huile-d-argan-pure": "/images/ingredients/argan-oil-public-domain.jpg",
  "ghassoul-poudre-minerale": "/images/ingredients/ghassoul-rhassoul-commons.png",
};

const productPhotos: Record<string, string> = {
  "savon-noir-beldi": "/images/products/savon-noir-beldi.png",
  "huile-d-argan-pure": "/images/products/huile-argan.png",
  "huile-de-baobab": "/images/products/huile-fenugrec.png",
  "ghassoul-poudre-minerale": "/images/products/ghassoul.png",
};

function getUploadedZaynaPhoto(product: Pick<Product, "image">): string | null {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (projectUrl) {
    try {
      const project = new URL(projectUrl);
      const image = new URL(product.image, project);
      if (
        image.origin === project.origin
        && image.pathname.startsWith("/storage/v1/object/public/zayna-products/")
      ) return image.toString();
    } catch {
      // Invalid URLs are handled as illustrative photos below.
    }
  }
  return null;
}

/** Prefer administrator-uploaded photos, then the matching local product photo, then a labelled ingredient/ritual photo. */
export function getProductPresentationImage(product: Pick<Product, "slug" | "image">): string {
  if (product.slug === "huile-de-baobab") return productPhotos[product.slug];
  return getUploadedZaynaPhoto(product) ?? productPhotos[product.slug] ?? illustrativePhotos[product.slug] ?? "/images/ritual-texture.jpg";
}

export function isProductIllustrativePhoto(product: Pick<Product, "slug" | "image">): boolean {
  return getUploadedZaynaPhoto(product) === null && !productPhotos[product.slug];
}
