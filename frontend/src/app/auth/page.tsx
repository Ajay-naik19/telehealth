"use client";

import { User, Heart } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import RoleCard from "@/components/RoleCard";
import { motion } from "framer-motion";
import Logo from "@/components/Logo";

export default function AuthPage() {
  return (
    <div className="auth-hero-bg flex min-h-screen flex-col">
      <Navbar />

      <motion.section
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="content-overlay flex flex-1 flex-col items-center justify-center px-6 py-20"
      >
        <div className="mb-10 text-center">
          <div className="mb-5 flex justify-center">
            <Logo size="lg" />
          </div>
          <h1 className="font-heading text-[36px] font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-[40px]">
            Get Started
          </h1>
          <p className="mt-2 text-[16px] text-slate-500 dark:text-slate-300">
            Choose your account type to continue
          </p>
        </div>

        <div className="flex w-full max-w-225 flex-col items-center justify-center gap-8 sm:flex-row">
          <RoleCard
            icon={User}
            title="I'm a Patient"
            description="Book appointments and consult doctors online."
            href="/auth/patient"
            accentColor="bg-sky-100"
            iconColor="text-sky-600"
          />
          <RoleCard
            icon={Heart}
            title="I'm a Doctor"
            description="Manage your clinic and conduct virtual consultations."
            href="/auth/doctor"
            accentColor="bg-emerald-100"
            iconColor="text-emerald-600"
          />
        </div>
      </motion.section>

      <Footer />
    </div>
  );
}
