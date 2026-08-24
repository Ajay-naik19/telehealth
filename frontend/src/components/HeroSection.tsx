"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Video, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HeroSection() {
  return (
    <section className="content-overlay relative overflow-hidden pb-20 pt-12 lg:pt-16">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-card/70 via-card/45 to-card" />
      <div className="pointer-events-none absolute -right-28 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-accent/12 blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center gap-12 px-6 lg:flex-row lg:gap-16">
        {/* Text */}
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex max-w-xl flex-1 flex-col items-start"
        >
          <span className="mb-5 inline-flex items-center gap-2 rounded-md border border-(--primary-border) bg-secondary px-4 py-1.5 text-[13px] font-semibold text-primary">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            Trusted by 10,000+ patients
          </span>

          <h1 className="font-heading text-[38px] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[46px] lg:text-[52px]">
            Healthcare{" "}
            <span className="text-primary">From Anywhere</span>
          </h1>

          <p className="mt-5 text-[18px] leading-relaxed text-muted-foreground">
            Secure video consultations with trusted doctors anytime. Book
            appointments, get AI-driven insights, and manage your health — all
            from the comfort of your home.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/auth">
              <Button className="group text-[16px] font-semibold">
                Book Appointment
                <ArrowRight className="ml-2 h-4.5 w-4.5 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/auth">
              <Button variant="secondary" className="text-[16px] font-semibold">Get Started</Button>
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-5 text-[14px] font-medium text-muted-foreground">
            <span className="flex items-center gap-2">
              <Video className="h-4.5 w-4.5 text-primary" /> HD Video Calls
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" /> HIPAA Secure
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4.5 w-4.5 text-accent" /> 24/7 Available
            </span>
          </div>
        </motion.div>

        {/* Illustration */}
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="relative flex-1"
        >
          <div className="relative animate-float overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <Image
              src="/heroo.png"
              alt="Doctor video consultation platform"
              width={1200}
              height={900}
              className="aspect-4/3 w-full object-cover"
              priority
            />
            <div className="absolute bottom-5 left-5 flex items-center gap-3 rounded-xl border border-border bg-card/90 px-4 py-2.5 shadow-lg backdrop-blur-md">
              <div className="icon-box flex h-9 w-9 items-center justify-center">
                <Video className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-foreground">Live Consultation</p>
                <p className="text-[11px] text-muted-foreground">Dr. Smith · Cardiology</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
