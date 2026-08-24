import type { Metadata } from "next";
import type { ReactNode } from "react";
import BreadcrumbJsonLd from "@/components/seo/BreadcrumbJsonLd";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Create TeleHealthx Account for Patients and Doctors",
  description:
    "Create your TeleHealthx account to book online doctor consultations and access secure medical records.",
  path: "/signup",
});

export default function SignupLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Signup", path: "/signup" },
        ]}
      />
      {children}
    </>
  );
}
