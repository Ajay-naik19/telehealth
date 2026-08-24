import type { Metadata } from "next";
import type { ReactNode } from "react";
import BreadcrumbJsonLd from "@/components/seo/BreadcrumbJsonLd";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Login to TeleHealthx Patient and Doctor Access Portal",
  description:
    "Sign in to TeleHealthx as a patient or doctor to manage consultations, appointments, prescriptions, and secure digital healthcare records.",
  path: "/auth",
});

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Login", path: "/auth" },
        ]}
      />
      {children}
    </>
  );
}
