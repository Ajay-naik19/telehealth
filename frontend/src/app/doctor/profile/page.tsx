"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  Award,
  Building2,
  Calendar,
  FileText,
  Loader2,
  Pencil,
  Sparkles,
  Stethoscope,
  User,
  Users,
  Video,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { extractContractData, isContractFailure } from "@/lib/contract";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/backend";

const doctorNav: NavItem[] = [
  { href: "/doctor/home", label: "Home", icon: Activity },
  { href: "/doctor/video/dashboard", label: "Video Consult", icon: Video },
  { href: "/doctor/schedule", label: "Schedule", icon: Calendar },
  { href: "/doctor/profile", label: "Profile", icon: Users },
];

const sectionAnim = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: "easeOut" as const },
};

interface DoctorProfileData {
  fullName: string;
  specialization: string;
  experience: number;
  qualification?: string;
  hospital?: string;
  bio?: string;
}

interface DoctorProfileResponse {
  profile: DoctorProfileData | null;
}

export default function DoctorProfilePage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<DoctorProfileData | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const initialTheme: "light" | "dark" =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : "light";

    document.documentElement.classList.toggle("dark", initialTheme === "dark");
    localStorage.setItem("theme", initialTheme);
    setTheme(initialTheme);
  }, []);

  const handleThemeToggle = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const res = await fetch(`${API_BASE}/doctor/profile`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });

        if (res.status === 401 || res.status === 403) {
          router.replace("/auth/doctor");
          return;
        }

        const raw = await res.json().catch(() => null);
        if (!res.ok || isContractFailure(raw)) {
          router.replace("/auth/doctor");
          return;
        }

        const data = extractContractData<DoctorProfileResponse | null>(raw);
        const loadedProfile = data?.profile;

        if (!cancelled && !loadedProfile) {
          router.replace("/doctor/profile/create");
          return;
        }

        if (!cancelled && loadedProfile) setProfile(loadedProfile);
      } catch {
        if (!cancelled) router.replace("/auth/doctor");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!profile) return null;

  const userName = profile.fullName ? `Dr. ${profile.fullName.split(" ")[0]}` : "Doctor";
  const userInitial = profile.fullName?.charAt(0).toUpperCase() || "D";

  const infoCards = [
    { label: "Full Name", value: profile.fullName, icon: User },
    { label: "Specialization", value: profile.specialization, icon: Stethoscope },
    { label: "Experience", value: `${profile.experience} years`, icon: Award },
    { label: "Qualification", value: profile.qualification || "Not specified", icon: FileText },
    { label: "Hospital / Clinic", value: profile.hospital || "Not specified", icon: Building2 },
  ];

  return (
    <DashboardLayout
      navItems={doctorNav}
      userName={userName}
      userInitial={userInitial}
      role="doctor"
      theme={theme}
      onToggleTheme={handleThemeToggle}
      footer={<Footer />}
    >
      <div className="space-y-8 pb-12">
        <motion.section
          {...sectionAnim}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-linear-to-br from-sky-50 via-white to-sky-100 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800"
        >
          <div className="flex flex-col gap-6 p-8 md:flex-row md:items-end md:justify-between md:p-10">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 shadow-sm dark:bg-slate-900/80 dark:text-white">
                <Sparkles className="h-3.5 w-3.5" />
                Doctor Profile
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">
                Professional Profile
              </h1>
              <p className="max-w-2xl text-[15px] leading-relaxed text-slate-600 dark:text-white">
                This mirrors the old doctor profile content: core credentials, specialization, experience, affiliation, and bio patients rely on when choosing care.
              </p>
            </div>
            <Link href="/doctor/profile/edit">
              <Button className="rounded-xl bg-sky-500 text-white hover:bg-sky-600">
                <Pencil className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
            </Link>
          </div>
        </motion.section>

        <motion.section
          {...sectionAnim}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {infoCards.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-500/15">
                    <Icon className="h-5 w-5 text-sky-600 dark:text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-white">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{item.value}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </motion.section>

        <motion.section
          {...sectionAnim}
          transition={{ duration: 0.4, delay: 0.12 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-8"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-500/15">
              <FileText className="h-5 w-5 text-sky-600 dark:text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Bio</h2>
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-600 dark:text-white">
                {profile.bio?.trim() ? profile.bio : "No bio added"}
              </p>
            </div>
          </div>
        </motion.section>
      </div>
    </DashboardLayout>
  );
}

