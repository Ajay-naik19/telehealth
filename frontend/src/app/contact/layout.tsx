import type { Metadata } from "next";
import type { ReactNode } from "react";
import BreadcrumbJsonLd from "@/components/seo/BreadcrumbJsonLd";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact TeleHealthx Support, Care Team, and Service Desk",
  description:
    "Contact TeleHealthx for appointment support, platform assistance, and healthcare service inquiries. Reach our team by phone, email, or message form.",
  path: "/contact",
});

export default function ContactLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ]}
      />
      {children}
    </>
  );
}
