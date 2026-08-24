import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import AppProviders from "@/components/providers/AppProviders";
import ScopedMedicalPattern from "@/components/layout/ScopedMedicalPattern";
import { defaultOgImage, siteName, siteUrl } from "@/lib/seo";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-logo",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TeleHealthx Online Doctor Consultations & e-Pharmacy",
    template: "%s | TeleHealthx",
  },
  description:
    "Book online doctor consultations, secure video appointments, and e-pharmacy support with TeleHealthx digital healthcare.",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName,
    url: siteUrl,
    title: "TeleHealthx Online Doctor Consultations & e-Pharmacy",
    description:
      "Book online doctor consultations, secure video appointments, and e-pharmacy support with TeleHealthx digital healthcare.",
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: "TeleHealthx branded healthcare platform preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TeleHealthx Online Doctor Consultations & e-Pharmacy",
    description:
      "Book online doctor consultations, secure video appointments, and e-pharmacy support with TeleHealthx digital healthcare.",
    images: [defaultOgImage],
  },
  verification: {
    google: "3hK4VzBvvznlnNArayPpCpNj86_JnogHro5uq-Rf1RY",
  },
  icons: {
    icon: "/logoo.png", // main favicon
    apple: "/logoo.png", // iOS
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteName,
  url: siteUrl,
  logo: `${siteUrl}/logoo.png`,
  sameAs: [
    "https://www.linkedin.com/in/abhijitreddy75",
    "https://github.com/abhijitreddy-06",
  ],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteName,
  url: siteUrl,
  potentialAction: {
    "@type": "SearchAction",
    target: `${siteUrl}/services?query={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${plusJakarta.variable} ${spaceGrotesk.variable} font-sans antialiased`}
      >
        <AppProviders>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(organizationSchema),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
          />
          <ScopedMedicalPattern />
          <div className="site-content">{children}</div>
          <Toaster richColors position="top-right" />
        </AppProviders>
      </body>
    </html>
  );
}
