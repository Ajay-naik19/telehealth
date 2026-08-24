"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  Award,
  BriefcaseMedical,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Save,
  Shield,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractContractData, extractContractMessage, isContractFailure } from "@/lib/contract";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/backend";

const doctorNav: NavItem[] = [
  { href: "/doctor/home", label: "Home", icon: Activity },
  { href: "/doctor/video/dashboard", label: "Video Consult", icon: Video },
  { href: "/doctor/schedule", label: "Schedule", icon: Calendar },
  { href: "/doctor/profile", label: "Profile", icon: Users },
];

const formSteps = [
  { id: 1, title: "Identity", description: "Public name patients will see" },
  { id: 2, title: "Practice", description: "Specialization, experience, and credentials" },
  { id: 3, title: "Presence", description: "Hospital affiliation and professional bio" },
];

const sectionAnim = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: "easeOut" as const },
};

interface DoctorProfileResponse {
  profile: {
    fullName: string;
    specialization: string;
    experience: number;
    qualification?: string;
    hospital?: string;
    bio?: string;
  } | null;
}

interface DoctorProfileFormState {
  fullName: string;
  specialization: string;
  experience: string;
  qualification: string;
  hospital: string;
  bio: string;
}

const initialForm: DoctorProfileFormState = {
  fullName: "",
  specialization: "",
  experience: "",
  qualification: "",
  hospital: "",
  bio: "",
};

export default function DoctorProfileCreatePage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<DoctorProfileFormState>(initialForm);

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

        if (!cancelled && loadedProfile) {
          setForm({
            fullName: loadedProfile.fullName || "",
            specialization: loadedProfile.specialization || "",
            experience: loadedProfile.experience ? String(loadedProfile.experience) : "",
            qualification: loadedProfile.qualification || "",
            hospital: loadedProfile.hospital || "",
            bio: loadedProfile.bio || "",
          });
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

  const userName = useMemo(() => {
    const name = form.fullName.trim();
    return name ? `Dr. ${name.split(" ")[0]}` : "Doctor";
  }, [form.fullName]);

  const userInitial = form.fullName.trim().charAt(0).toUpperCase() || "D";
  const isUpdate = Boolean(form.fullName.trim());

  const handleChange = (field: keyof DoctorProfileFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number) => {
    if (step === 1) {
      if (!form.fullName.trim() || form.fullName.trim().length < 2) {
        setError("Please enter your full name.");
        return false;
      }
    }

    if (step === 2) {
      if (!form.specialization.trim() || form.specialization.trim().length < 2) {
        setError("Please enter your specialization.");
        return false;
      }
      const experience = Number(form.experience);
      if (!Number.isInteger(experience) || experience < 0 || experience > 70) {
        setError("Experience must be a whole number between 0 and 70.");
        return false;
      }
    }

    setError("");
    return true;
  };

  const nextStep = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((prev) => Math.min(prev + 1, formSteps.length));
  };

  const previousStep = () => {
    setError("");
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateStep(3)) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_BASE}/doctor/profile`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          specialization: form.specialization.trim(),
          experience: Number(form.experience),
          qualification: form.qualification.trim(),
          hospital: form.hospital.trim(),
          bio: form.bio.trim(),
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      const isJsonResponse = contentType.includes("application/json");
      const rawResult = (isJsonResponse
        ? await response.json().catch(() => null)
        : null) as unknown;

      const result = extractContractData<{ success?: boolean; message?: string } | null>(rawResult);

      if (!response.ok) {
        throw new Error(extractContractMessage(rawResult, "Unable to save your doctor profile."));
      }

      if (!isJsonResponse || isContractFailure(rawResult)) {
        throw new Error("Session expired or invalid response from server. Please login and try again.");
      }

      setSuccess(isUpdate ? "Doctor profile updated successfully." : "Doctor profile created successfully.");
      router.push("/doctor/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your doctor profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

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
          <div className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between md:p-10">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 shadow-sm dark:bg-slate-900/80 dark:text-sky-300">
                <Sparkles className="h-3.5 w-3.5" />
                Doctor Presence
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
                {isUpdate ? "Refine Your Doctor Profile" : "Create Your Doctor Profile"}
              </h1>
              <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                This follows the legacy three-step doctor profile flow: identity, practice details, and public-facing professional information for patients.
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Current step</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {currentStep} / {formSteps.length}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {formSteps[currentStep - 1]?.title}
              </p>
            </div>
          </div>
        </motion.section>

        <motion.section
          {...sectionAnim}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="grid gap-4 md:grid-cols-3"
        >
          {formSteps.map((step) => {
            const active = step.id === currentStep;
            const complete = step.id < currentStep;
            return (
              <div
                key={step.id}
                className={`rounded-2xl border p-5 shadow-sm transition ${
                  active
                    ? "border-sky-300 bg-sky-50 dark:border-sky-500/40 dark:bg-sky-500/10"
                    : complete
                      ? "border-sky-300 bg-sky-50 dark:border-sky-500/40 dark:bg-sky-500/10"
                      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                      active
                        ? "bg-sky-500 text-white"
                        : complete
                          ? "bg-sky-500 text-white"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {step.id}
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900 dark:text-slate-100">{step.title}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{step.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </motion.section>

        <motion.form
          {...sectionAnim}
          transition={{ duration: 0.4, delay: 0.12 }}
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-8"
        >
          <div className="mb-8 flex items-start justify-between gap-4 border-b border-slate-100 pb-6 dark:border-slate-800">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {formSteps[currentStep - 1]?.title}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Same legacy content, rebuilt in the current dashboard shell with cleaner spacing and stronger hierarchy.
              </p>
            </div>
            <Link href="/doctor/profile" className="text-sm font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400">
              View profile
            </Link>
          </div>

          {currentStep === 1 && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => handleChange("fullName", e.target.value)}
                  placeholder="Dr. Jane Smith"
                  className="mt-2 h-12 rounded-xl"
                />
              </div>
              <div className="md:col-span-2 rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-500/30 dark:bg-sky-500/10">
                <div className="flex items-start gap-3">
                  <Shield className="mt-0.5 h-5 w-5 text-sky-600 dark:text-sky-300" />
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">Visible to patients</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Your full name is the primary identity field from the legacy profile form and is shown throughout appointments and consultation flows.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="specialization">Specialization</Label>
                <Input
                  id="specialization"
                  value={form.specialization}
                  onChange={(e) => handleChange("specialization", e.target.value)}
                  placeholder="Cardiology, Dermatology, Neurology..."
                  className="mt-2 h-12 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="experience">Experience (years)</Label>
                <Input
                  id="experience"
                  type="number"
                  min="0"
                  max="70"
                  value={form.experience}
                  onChange={(e) => handleChange("experience", e.target.value)}
                  className="mt-2 h-12 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="qualification">Qualification</Label>
                <Input
                  id="qualification"
                  value={form.qualification}
                  onChange={(e) => handleChange("qualification", e.target.value)}
                  placeholder="MBBS, MD, DM, MS..."
                  className="mt-2 h-12 rounded-xl"
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center gap-3">
                  <BriefcaseMedical className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Specialization</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{form.specialization || "Not set yet"}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center gap-3">
                  <Award className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Experience</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{form.experience || "0"} years</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="grid gap-6">
              <div>
                <Label htmlFor="hospital">Hospital / Clinic</Label>
                <Input
                  id="hospital"
                  value={form.hospital}
                  onChange={(e) => handleChange("hospital", e.target.value)}
                  placeholder="Apollo Hospital, City Clinic, Private Practice..."
                  className="mt-2 h-12 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="bio">Professional Bio</Label>
                <textarea
                  id="bio"
                  value={form.bio}
                  onChange={(e) => handleChange("bio", e.target.value)}
                  rows={6}
                  maxLength={1000}
                  placeholder="Tell patients about your clinical experience, treatment style, and focus areas."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-emerald-500/20"
                />
                <p className="mt-2 text-right text-xs text-slate-500 dark:text-slate-400">
                  {form.bio.length} / 1000
                </p>
              </div>
            </div>
          )}

          {(error || success) && (
            <div className="mt-6 space-y-3">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {success}
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-6 dark:border-slate-800 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={previousStep}
              disabled={currentStep === 1}
              className="rounded-xl"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            {currentStep < formSteps.length ? (
              <Button type="button" onClick={nextStep} className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-600">
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={saving} className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-600">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isUpdate ? "Update Profile" : "Complete Profile"}
              </Button>
            )}
          </div>
        </motion.form>
      </div>
    </DashboardLayout>
  );
}
