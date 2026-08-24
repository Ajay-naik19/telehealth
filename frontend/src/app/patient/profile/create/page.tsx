"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Heart,
  Loader2,
  Pill,
  Save,
  Shield,
  User,
  Video,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractContractData, extractContractMessage, isContractFailure } from "@/lib/contract";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/backend";

const patientNav: NavItem[] = [
  { href: "/patient/home", label: "Home", icon: Activity },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/patient/video/dashboard", label: "Video Consult", icon: Video },
  { href: "/pharmacy", label: "Pharmacy", icon: Pill },
  { href: "/records", label: "My Records", icon: FileText },
];

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const formSteps = [
  { id: 1, title: "Personal Info", description: "Basic identity and age details" },
  { id: 2, title: "Body Metrics", description: "Height and weight used in medical context" },
  { id: 3, title: "Medical Details", description: "Blood group and allergies" },
];

const sectionAnim = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: "easeOut" as const },
};

interface UserProfileResponse {
  profile: {
    fullName: string;
    gender: string;
    customGender?: string;
    dob: string;
    weight: number;
    height: number;
    bloodGroup: string;
    allergies?: string;
  } | null;
}

interface UserProfileFormState {
  fullName: string;
  gender: string;
  customGender: string;
  dob: string;
  weight: string;
  height: string;
  bloodGroup: string;
  allergies: string;
}

const initialForm: UserProfileFormState = {
  fullName: "",
  gender: "male",
  customGender: "",
  dob: "",
  weight: "70",
  height: "170",
  bloodGroup: "",
  allergies: "",
};

export default function UserProfileCreatePage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<UserProfileFormState>(initialForm);

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

        if (!cancelled && loadedProfile) {
          setForm({
            fullName: loadedProfile.fullName || "",
            gender: loadedProfile.gender || "male",
            customGender: loadedProfile.customGender || "",
            dob: loadedProfile.dob ? String(loadedProfile.dob).slice(0, 10) : "",
            weight: loadedProfile.weight ? String(loadedProfile.weight) : "70",
            height: loadedProfile.height ? String(loadedProfile.height) : "170",
            bloodGroup: loadedProfile.bloodGroup || "",
            allergies: loadedProfile.allergies || "",
          });
        }
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

  const userName = useMemo(() => {
    const name = form.fullName.trim();
    return name ? name.split(" ")[0] : "Patient";
  }, [form.fullName]);

  const userInitial = userName.charAt(0).toUpperCase() || "P";
  const isUpdate = Boolean(form.fullName.trim());

  const maxDob = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 18);
    return date.toISOString().split("T")[0];
  }, []);

  const handleChange = (field: keyof UserProfileFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number) => {
    if (step === 1) {
      if (!form.fullName.trim() || form.fullName.trim().length < 2) {
        setError("Please enter your full name.");
        return false;
      }
      if (!form.dob) {
        setError("Please select your date of birth.");
        return false;
      }
      if (form.gender === "other" && !form.customGender.trim()) {
        setError("Please specify your gender.");
        return false;
      }
    }

    if (step === 2) {
      const weight = Number(form.weight);
      const height = Number(form.height);
      if (!Number.isFinite(weight) || weight < 2 || weight > 500) {
        setError("Weight must be between 2 and 500 kg.");
        return false;
      }
      if (!Number.isFinite(height) || height < 30 || height > 300) {
        setError("Height must be between 30 and 300 cm.");
        return false;
      }
    }

    if (step === 3 && !form.bloodGroup) {
      setError("Please select your blood group.");
      return false;
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
      const response = await fetch(`${API_BASE}/patient/profile`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          gender: form.gender,
          customGender: form.gender === "other" ? form.customGender.trim() : "",
          dob: form.dob,
          weight: Number(form.weight),
          height: Number(form.height),
          bloodGroup: form.bloodGroup,
          allergies: form.allergies.trim(),
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      const isJsonResponse = contentType.includes("application/json");
      const rawResult = (isJsonResponse
        ? await response.json().catch(() => null)
        : null) as unknown;

      const result = extractContractData<{ success?: boolean; message?: string } | null>(rawResult);

      if (!response.ok) {
        throw new Error(extractContractMessage(rawResult, "Unable to save your profile."));
      }

      if (!isJsonResponse || isContractFailure(rawResult)) {
        throw new Error("Session expired or invalid response from server. Please login and try again.");
      }

      setSuccess(isUpdate ? "Profile updated successfully." : "Profile created successfully.");
      router.push("/patient/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your profile.");
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
          <div className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between md:p-10">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 shadow-sm dark:bg-slate-900/80 dark:text-sky-300">
                <Shield className="h-3.5 w-3.5" />
                Health Profile
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
                {isUpdate ? "Keep Your Profile Accurate" : "Create Your Patient Profile"}
              </h1>
              <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                Based on the legacy flow, this profile captures identity, body metrics, and essential medical details so appointments and care recommendations stay accurate.
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
                      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10"
                      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                      active
                        ? "bg-sky-500 text-white"
                        : complete
                          ? "bg-emerald-500 text-white"
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
                Complete the same information the old profile form requested, now in the new dashboard UI.
              </p>
            </div>
            <Link href="/patient/profile" className="text-sm font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400">
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
                  placeholder="Enter your full name"
                  className="mt-2 h-12 rounded-xl"
                />
              </div>

              <div className="md:col-span-2">
                <Label>Gender</Label>
                <div className="mt-2 flex flex-wrap gap-3">
                  {[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "other", label: "Other" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleChange("gender", option.value)}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        form.gender === option.value
                          ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-500/10 dark:text-sky-300"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.gender === "other" && (
                <div className="md:col-span-2">
                  <Label htmlFor="customGender">Custom Gender</Label>
                  <Input
                    id="customGender"
                    value={form.customGender}
                    onChange={(e) => handleChange("customGender", e.target.value)}
                    placeholder="Describe your gender"
                    className="mt-2 h-12 rounded-xl"
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  max={maxDob}
                  value={form.dob}
                  onChange={(e) => handleChange("dob", e.target.value)}
                  className="mt-2 h-12 rounded-xl"
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  min="2"
                  max="500"
                  value={form.weight}
                  onChange={(e) => handleChange("weight", e.target.value)}
                  className="mt-2 h-12 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  min="30"
                  max="300"
                  value={form.height}
                  onChange={(e) => handleChange("height", e.target.value)}
                  className="mt-2 h-12 rounded-xl"
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Body Weight</p>
                <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{form.weight || "0"} kg</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Height</p>
                <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{form.height || "0"} cm</p>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <Label htmlFor="bloodGroup">Blood Group</Label>
                <select
                  id="bloodGroup"
                  value={form.bloodGroup}
                  onChange={(e) => handleChange("bloodGroup", e.target.value)}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-500/20"
                >
                  <option value="">Select your blood group</option>
                  {bloodGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="allergies">Allergies</Label>
                <Input
                  id="allergies"
                  value={form.allergies}
                  onChange={(e) => handleChange("allergies", e.target.value)}
                  placeholder="Peanuts, pollen, penicillin, etc."
                  className="mt-2 h-12 rounded-xl"
                />
              </div>
              <div className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
                <div className="flex items-start gap-3">
                  <Heart className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-300" />
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">Why this matters</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      The legacy patient profile emphasized blood group and allergies so doctors can make safer decisions quickly during video consultations.
                    </p>
                  </div>
                </div>
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
              <Button type="button" onClick={nextStep} className="rounded-xl bg-sky-500 text-white hover:bg-sky-600">
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
