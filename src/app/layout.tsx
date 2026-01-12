import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "BrandVox Email Automation",
    template: "%s | BrandVox",
  },
  description: "AI-powered B2B email outreach with human-in-the-loop review. Generate personalized emails, manage campaigns, and streamline your outreach with intelligent automation.",
  keywords: [
    "email automation",
    "B2B outreach",
    "email marketing",
    "AI email",
    "sales automation",
    "lead generation",
    "email campaigns",
    "personalized emails",
  ],
  authors: [{ name: "BrandVox" }],
  creator: "BrandVox",
  publisher: "BrandVox",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "BrandVox Email Automation",
    title: "BrandVox Email Automation",
    description: "AI-powered B2B email outreach with human-in-the-loop review. Generate personalized emails, manage campaigns, and streamline your outreach.",
  },
  twitter: {
    card: "summary_large_image",
    title: "BrandVox Email Automation",
    description: "AI-powered B2B email outreach with human-in-the-loop review.",
    creator: "@brandvox",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${outfit.variable} ${jetbrainsMono.variable} font-sans`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
