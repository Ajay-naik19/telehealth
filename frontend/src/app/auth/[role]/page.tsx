import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthCard from "@/components/AuthCard";
import Logo from "@/components/Logo";
import { buildPageMetadata } from "@/lib/seo";

type Role = "patient" | "doctor";

export default async function AuthRolePage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;

  if (role !== "patient" && role !== "doctor") {
    notFound();
  }

  return (
    <div className="auth-hero-bg flex min-h-screen flex-col">
      <Navbar />

      <section className="content-overlay flex flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Logo size="lg" className="mb-2" />
          <Link
            href="/auth"
            className="menu-item flex items-center gap-2 text-[16px] font-semibold text-sky-700 transition-colors hover:text-primary dark:text-sky-200 dark:hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Role Selection
          </Link>
        </div>

        <div className="w-full flex justify-center">
          <AuthCard role={role as Role} />
        </div>
      </section>

      <Footer />
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ role: string }>;
}): Promise<Metadata> {
  const { role } = await params;

  if (role === "patient") {
    return buildPageMetadata({
      title: "Patient Login for TeleHealthx Doctor Consult Platform",
      description:
        "Patient login for TeleHealthx to book doctor appointments, join secure video consultations, and access digital prescriptions and health records.",
      path: "/auth/patient",
    });
  }

  if (role === "doctor") {
    return buildPageMetadata({
      title: "Doctor Login for TeleHealthx Consultation Dashboard",
      description:
        "Doctor login for TeleHealthx to manage schedules, virtual consultations, patient interactions, and prescription workflows securely online.",
      path: "/auth/doctor",
    });
  }

  return {
    robots: {
      index: false,
      follow: false,
    },
  };
}
