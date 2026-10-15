export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  size: string;
  description: string;
  image: string;
  tone: string;
  tag?: string;
};

// Starter catalogue: replace these draft prices, descriptions and product photos with verified brand data.
export const products: Product[] = [
  {
    id: "savon-noir",
    slug: "savon-noir-beldi",
    name: "Savon noir beldi",
    category: "Rituel hammam",
    price: 8500,
    size: "200 g",
    description: "La pâte végétale traditionnelle qui prépare la peau au rituel du hammam.",
    image: "/images/ingredients/savon-noir.jpg",
    tone: "#eadfd2",
    tag: "Le rituel",
  },
  {
    id: "huile-argan",
    slug: "huile-d-argan-pure",
    name: "Huile d’argan pure",
    category: "Huiles précieuses",
    price: 14500,
    size: "50 ml",
    description: "Une huile dorée et généreuse, à intégrer à votre rituel visage et corps.",
    image: "/images/ingredients/argan-preparation.jpg",
    tone: "#e5d6b9",
    tag: "Origine Maroc",
  },
  {
    id: "huile-baobab",
    slug: "huile-de-baobab",
    name: "Huile de fenugrec",
    category: "Huiles précieuses",
    price: 12000,
    size: "50 ml",
    description: "Une huile végétale inspirée des arbres majestueux de nos terres.",
    image: "/images/ingredients/baobab-pulpe.jpg",
    tone: "#dfd0c5",
    tag: "Soin essentiel",
  },
  {
    id: "ghassoul",
    slug: "ghassoul-poudre-minerale",
    name: "Ghassoul minéral",
    category: "Rituel hammam",
    price: 9500,
    size: "250 g",
    description: "L’argile volcanique du Maroc pour un moment de soin tout en douceur.",
    image: "/images/ingredients/argile-rituel.jpg",
    tone: "#d9c9bc",
    tag: "Naturellement",
  },
];

export const formatPrice = (price: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(price) + " FCFA";
