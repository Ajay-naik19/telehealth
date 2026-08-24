"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  Calendar,
  FileText,
  Heart,
  Loader2,
  Pencil,
  Pill,
  Shield,
  User,
  Video,
  Weight,
  Ruler,
  Droplets,
  Cake,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { extractContractData, isContractFailure } from "@/lib/contract";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/backend";

const patientNav: NavItem[] = [
  { href: "/patient/home", label: "Home", icon: Activity },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/patient/video/dashboard", label: "Video Consult", icon: Video },
  { href: "/pharmacy", label: "Pharmacy", icon: Pill },
  { href: "/records", label: "My Records", icon: FileText },
];

const sectionAnim = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: "easeOut" as const },
};

interface UserProfileData {
  fullName: string;
  gender: string;
  customGender?: string;
  dob: string;
  weight: number;
  height: number;
  bloodGroup: string;
  allergies?: string;
}

interface UserProfileResponse {
  profile: UserProfileData | null;
}

export default function UserProfilePage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileData | null>(null);

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
        const res = await fetch(`${API_BASE}/patient/profile`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });

        if (res.status === 401 || res.status === 403) {
          router.replace("/auth/patient");
          return;
        }

        const raw = await res.json().catch(() => null);
        if (!res.ok || isContractFailure(raw)) {
          router.replace("/auth/patient");
          return;
        }

        const data = extractContractData<UserProfileResponse | null>(raw);
        const loadedProfile = data?.profile;

        if (!cancelled && !loadedProfile) {
          router.replace("/patient/profile/create");
          return;
        }

        if (!cancelled && loadedProfile) setProfile(loadedProfile);
      } catch {
        if (!cancelled) router.replace("/auth/patient");
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

  const userName = profile.fullName?.split(" ")[0] || "Patient";
  const userInitial = userName.charAt(0).toUpperCase() || "P";
  const displayGender = profile.gender === "other" ? profile.customGender || "Other" : profile.gender;

  const infoCards = [
    { label: "Full Name", value: profile.fullName, icon: User },
    {
      label: "Date of Birth",
      value: profile.dob
        ? new Date(profile.dob).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
        : "Not specified",
      icon: Cake,
    },
    { label: "Gender", value: displayGender || "Not specified", icon: User },
    { label: "Height", value: `${profile.height} cm`, icon: Ruler },
    { label: "Weight", value: `${profile.weight} kg`, icon: Weight },
    { label: "Blood Group", value: profile.bloodGroup || "Not specified", icon: Droplets },
  ];

  return (
    <DashboardLayout
      navItems={patientNav}
      userName={userName}
      userInitial={userInitial}
      role="patient"
      theme={theme}
      onToggleTheme={handleThemeToggle}
      footer={<Footer />}
    >
      <div className="space-y-8 pb-12">
        <motion.section
          {...sectionAnim}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-linear-to-br from-sky-50 via-white to-emerald-50 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800"
        >
          <div className="flex flex-col gap-6 p-8 md:flex-row md:items-end md:justify-between md:p-10">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 shadow-sm dark:bg-slate-900/80 dark:text-sky-300">
                <Shield className="h-3.5 w-3.5" />
                Personal Health Snapshot
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
                Your Profile
              </h1>
              <p className="max-w-2xl text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                The legacy profile page focused on the essentials doctors need fast: identity, birth date, body metrics, blood group, and allergies.
              </p>
            </div>
            <Link href="/patient/profile/edit">
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
                    <Icon className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{item.value}</p>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/15">
              <Heart className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Allergies</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                {profile.allergies?.trim() ? profile.allergies : "None"}
              </p>
            </div>
          </div>
        </motion.section>
      </div>
    </DashboardLayout>
  );
}
