import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "ZAYNA AFRICA — La beauté de nos origines",
  description: "Des rituels de beauté naturels inspirés de l’Afrique et du Maroc.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body className={`${sans.variable} ${serif.variable}`}>{children}</body></html>;
}
