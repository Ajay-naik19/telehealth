import type { Metadata } from "next";

const FALLBACK_SITE_URL = "https://telehealthx.vercel.app";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL).replace(/\/$/, "");
export const siteName = "TeleHealthx";
export const defaultOgImage = `${siteUrl}/image.png`;

type PageMetaInput = {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
};

export function buildPageMetadata({
  title,
  description,
  path,
  type = "website",
}: PageMetaInput): Metadata {
  const canonicalPath = path.startsWith("/") ? path : `/${path}`;
  const absoluteUrl = `${siteUrl}${canonicalPath}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl,
      siteName,
      type,
      images: [
        {
          url: defaultOgImage,
          width: 1200,
          height: 630,
          alt: "TeleHealthx platform preview",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [defaultOgImage],
    },
  };
}
