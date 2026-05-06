import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk, Syne } from "next/font/google";
import { getLocale } from "@/lib/i18n/dictionaries";
import "./globals.css";

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://agora.talia.events"),
  title: "Talía",
  description: "AI attention platform for cultural organizations",
  openGraph: {
    title: "Talía",
    description: "AI attention platform for cultural organizations",
    url: "/",
    siteName: "Talía",
    images: [
      {
        url: "/talia-miniatura.png",
        width: 1846,
        height: 2304,
        alt: "Talía",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Talía",
    description: "AI attention platform for cultural organizations",
    images: ["/talia-miniatura.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale()

  return (
    <html lang={locale} data-theme="light" className={`${syne.variable} ${spaceGrotesk.variable} ${jetBrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
