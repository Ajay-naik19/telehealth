import type { Metadata } from "next";
import type { ReactNode } from "react";
import BreadcrumbJsonLd from "@/components/seo/BreadcrumbJsonLd";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Online Healthcare Services: Video and Pharmacy Support",
  description:
    "Explore TeleHealthx services including video doctor consultations, e-prescriptions, specialist referrals, and secure health records.",
  path: "/services",
});

export default function ServicesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
        ]}
      />
      {children}
    </>
  );
}
