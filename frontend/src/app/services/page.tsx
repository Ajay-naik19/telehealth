"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ServiceCard from "@/components/ServiceCard";
import { motion } from "framer-motion";
import {
  Video,
  Brain,
  Pill,
  CalendarCheck,
  Stethoscope,
  HeartPulse,
} from "lucide-react";

const services = [
  {
    icon: Video,
    title: "Video Consultation",
    description:
      "Connect face-to-face with certified doctors through crystal-clear HD video calls.",
    href: "/auth",
    accentColor: "bg-sky-50",
    iconColor: "text-sky-600",
  },
  {
    icon: Brain,
    title: "Pre-Visit Guidance",
    description:
      "Share your concerns before consultation to help doctors prepare and respond faster.",
    href: "/auth",
    accentColor: "bg-violet-50",
    iconColor: "text-violet-600",
  },
  {
    icon: Pill,
    title: "Prescription Support",
    description:
      "Receive digital prescriptions instantly after your consultation.",
    href: "/auth",
    accentColor: "bg-cyan-50",
    iconColor: "text-cyan-600",
  },
  {
    icon: CalendarCheck,
    title: "Smart Appointments",
    description:
      "See real-time doctor availability and book appointments in seconds.",
    href: "/auth",
    accentColor: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    icon: Stethoscope,
    title: "Specialist Referrals",
    description:
      "Get connected with verified specialists across every discipline.",
    href: "/auth",
    accentColor: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    icon: HeartPulse,
    title: "Medical Records",
    description:
      "All your records securely stored and accessible anytime through our vault.",
    href: "/auth",
    accentColor: "bg-rose-50",
    iconColor: "text-rose-600",
  },
];

export default function ServicesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <motion.section
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="content-overlay py-24"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 text-center">
            <span className="mb-3 inline-block text-[13px] font-bold uppercase tracking-wider text-sky-600">
              Our Services
            </span>
            <h1 className="font-heading text-[36px] font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-[42px]">
              Comprehensive Digital Healthcare
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-[17px] leading-relaxed text-slate-500 dark:text-slate-300">
              From video consultations to pharmacy support, everything you need.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <ServiceCard key={s.title} {...s} />
            ))}
          </div>
        </div>
      </motion.section>

      <Footer />
    </div>
  );
}
