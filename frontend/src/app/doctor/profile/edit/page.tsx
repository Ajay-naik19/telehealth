"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  Calendar,
  Loader2,
  Sparkles,
  Stethoscope,
  Users,
  Video,
  ArrowLeft,
  Save,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { extractContractData, extractContractMessage, isContractFailure } from "@/lib/contract";

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

interface ApiErrorDetail {
  field: string;
  message: string;
}

interface ApiErrorResponse {
  error?: string;
  message?: string;
  details?: ApiErrorDetail[];
}

const SPECIALIZATIONS = [
  "General Physician",
  "Cardiologist",
  "Dermatologist",
  "Neurologist",
  "Orthopedic",
  "Pediatrician",
  "Psychiatrist",
  "Gynecologist",
  "ENT Specialist",
  "Ophthalmologist",
  "Dentist",
  "Other",
];

export default function EditDoctorProfilePage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<DoctorProfileData | null>(null);
  const [formData, setFormData] = useState<DoctorProfileData>({
    fullName: "",
    specialization: "",
    experience: 0,
    qualification: "",
    hospital: "",
    bio: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

        if (!cancelled && loadedProfile) {
          setProfile(loadedProfile);
          setFormData(loadedProfile);
        }
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

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "experience" ? parseInt(value) : value,
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.fullName?.trim() || formData.fullName.length < 2 || formData.fullName.length > 100) {
      setError("Full name must be between 2 and 100 characters");
      return false;
    }
    if (!formData.specialization) {
      setError("Specialization is required");
      return false;
    }
    if (formData.experience < 0 || formData.experience > 70) {
      setError("Experience must be between 0 and 70 years");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/doctor/profile/edit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(formData),
      });

      let data: ApiErrorResponse | null = null;
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        data = (await res.json()) as ApiErrorResponse;
      }

      const parsed = extractContractData<ApiErrorResponse | null>(data);

      if (!res.ok || isContractFailure(data)) {
        if (parsed?.details?.length) {
          const errorMessage = parsed.details.map((d) => `${d.field}: ${d.message}`).join(", ");
          setError(`Validation failed: ${errorMessage}`);
        } else {
          setError(extractContractMessage(data, "Failed to update profile"));
        }

        if (process.env.NODE_ENV !== "production") {
          console.warn("Profile update request failed", {
            status: res.status,
            statusText: res.statusText,
            data: parsed,
            url: `${API_BASE}/doctor/profile/edit`,
          });
        }
        return;
      }

      setSuccess("Profile updated successfully!");
      setTimeout(() => {
        router.push("/doctor/profile");
      }, 1500);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("An error occurred while updating your profile");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!profile) return null;

  const userName = profile.fullName?.split(" ")[0] || "Doctor";
  const userInitial = userName.charAt(0).toUpperCase() || "D";

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
          className="overflow-hidden rounded-2xl border border-slate-200 bg-linear-to-br from-sky-50 via-white to-emerald-50 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800"
        >
          <div className="flex flex-col gap-6 p-8 md:flex-row md:items-end md:justify-between md:p-10">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 shadow-sm dark:bg-slate-900/80 dark:text-sky-300">
                <Sparkles className="h-3.5 w-3.5" />
                Update Professional Information
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
                Edit Your Profile
              </h1>
              <p className="max-w-2xl text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                Update your professional credentials and details that patients will see.
              </p>
            </div>
            <Link href="/doctor/profile">
              <Button variant="outline" className="rounded-xl">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </Link>
          </div>
        </motion.section>

        <motion.section
          {...sectionAnim}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-8"
        >
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                Full Name
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                required
                minLength={2}
                maxLength={100}
                placeholder="Enter your full name"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white/50 px-4 py-2.5 text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-sky-400 dark:focus:ring-sky-400/10"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">2 to 100 characters</p>
            </div>

            {/* Specialization and Experience */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="specialization" className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Specialization
                </label>
                <select
                  id="specialization"
                  name="specialization"
                  value={formData.specialization}
                  onChange={handleInputChange}
                  required
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white/50 px-4 py-2.5 text-slate-900 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100"
                >
                  <option value="">Select specialization</option>
                  {SPECIALIZATIONS.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="experience" className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Experience (Years)
                </label>
                <input
                  type="number"
                  id="experience"
                  name="experience"
                  value={formData.experience || ""}
                  onChange={handleInputChange}
                  required
                  min={0}
                  max={70}
                  placeholder="Years of experience"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white/50 px-4 py-2.5 text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder-slate-500"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Between 0 and 70 years</p>
              </div>
            </div>

            {/* Qualification */}
            <div>
              <label htmlFor="qualification" className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                Qualification
              </label>
              <input
                type="text"
                id="qualification"
                name="qualification"
                value={formData.qualification || ""}
                onChange={handleInputChange}
                placeholder="e.g., MBBS, MD, FRCS"
                maxLength={200}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white/50 px-4 py-2.5 text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder-slate-500"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Max 200 characters</p>
            </div>

            {/* Hospital */}
            <div>
              <label htmlFor="hospital" className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                Hospital / Clinic
              </label>
              <input
                type="text"
                id="hospital"
                name="hospital"
                value={formData.hospital || ""}
                onChange={handleInputChange}
                placeholder="Enter your workplace"
                maxLength={200}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white/50 px-4 py-2.5 text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder-slate-500"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Max 200 characters</p>
            </div>

            {/* Bio */}
            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio || ""}
                onChange={handleInputChange}
                placeholder="Tell patients about yourself, your experience, and areas of expertise"
                maxLength={1000}
                rows={5}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white/50 px-4 py-2.5 text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder-slate-500"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Max 1000 characters</p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <Link href="/doctor/profile" className="flex-1">
                <Button variant="outline" className="w-full rounded-xl">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-xl bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </motion.section>
      </div>
    </DashboardLayout>
  );
}
