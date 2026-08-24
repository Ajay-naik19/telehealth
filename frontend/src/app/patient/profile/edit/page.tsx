"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  Calendar,
  FileText,
  Loader2,
  Pill,
  Shield,
  User,
  Video,
  ChevronDown,
  ArrowLeft,
  Save,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { extractContractData, extractContractMessage, isContractFailure } from "@/lib/contract";

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

interface ApiErrorDetail {
  field: string;
  message: string;
}

interface ApiErrorResponse {
  error?: string;
  message?: string;
  details?: ApiErrorDetail[];
}

export default function EditUserProfilePage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [formData, setFormData] = useState<UserProfileData>({
    fullName: "",
    gender: "male",
    customGender: "",
    dob: "",
    weight: 0,
    height: 0,
    bloodGroup: "",
    allergies: "",
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

        if (!cancelled && loadedProfile) {
          const normalizedProfile: UserProfileData = {
            ...loadedProfile,
            customGender: typeof loadedProfile.customGender === "string" ? loadedProfile.customGender : "",
          };

          setProfile(normalizedProfile);
          // Ensure dob is in YYYY-MM-DD format for the date input
          const profileData = {
            ...normalizedProfile,
            dob: loadedProfile.dob
              ? loadedProfile.dob.split("T")[0] || loadedProfile.dob
              : "",
          };
          setFormData(profileData);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "weight" || name === "height" ? parseFloat(value) : value,
    }));
  };

  const handleGenderChange = (selectedGender: string) => {
    setFormData((prev) => ({
      ...prev,
      gender: selectedGender,
      customGender: selectedGender === "other" ? prev.customGender : "",
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.fullName?.trim() || formData.fullName.length < 2 || formData.fullName.length > 100) {
      setError("Full name must be between 2 and 100 characters");
      return false;
    }
    if (!formData.dob) {
      setError("Date of birth is required");
      return false;
    }
    const dob = new Date(formData.dob);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    if (age < 18) {
      setError("You must be at least 18 years old");
      return false;
    }
    if (!formData.weight || formData.weight < 2 || formData.weight > 500) {
      setError("Weight must be between 2 and 500 kg");
      return false;
    }
    if (!formData.height || formData.height < 30 || formData.height > 300) {
      setError("Height must be between 30 and 300 cm");
      return false;
    }
    if (!formData.bloodGroup) {
      setError("Blood group is required");
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
      const payload: UserProfileData = {
        ...formData,
        customGender:
          formData.gender === "other"
            ? (formData.customGender || "").trim()
            : "",
      };

      const res = await fetch(`${API_BASE}/patient/profile/edit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
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
            url: `${API_BASE}/patient/profile/edit`,
          });
        }
        return;
      }

      setSuccess("Profile updated successfully!");
      setTimeout(() => {
        router.push("/patient/profile");
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

  const userName = profile.fullName?.split(" ")[0] || "Patient";
  const userInitial = userName.charAt(0).toUpperCase() || "P";
  const dobValue = formData.dob || "";

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
                Update Health Information
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
                Edit Your Profile
              </h1>
              <p className="max-w-2xl text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                Update your personal health information. All fields are important for accurate medical records.
              </p>
            </div>
            <Link href="/patient/profile">
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

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">Gender</label>
              <div className="mt-3 flex gap-3">
                {["male", "female", "other"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleGenderChange(option)}
                    className={`flex-1 rounded-xl border-2 px-4 py-2 text-sm font-medium transition ${
                      formData.gender === option
                        ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                        : "border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
              {formData.gender === "other" && (
                <input
                  type="text"
                  name="customGender"
                  value={formData.customGender || ""}
                  onChange={handleInputChange}
                  placeholder="Specify your gender"
                  maxLength={50}
                  className="mt-3 w-full rounded-xl border border-slate-300 bg-white/50 px-4 py-2.5 text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder-slate-500"
                />
              )}
            </div>

            {/* Date of Birth */}
            <div>
              <label htmlFor="dob" className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                Date of Birth
              </label>
              <input
                type="date"
                id="dob"
                name="dob"
                value={dobValue}
                onChange={handleInputChange}
                required
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white/50 px-4 py-2.5 text-slate-900 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Must be at least 18 years old</p>
            </div>

            {/* Weight and Height */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="weight" className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  id="weight"
                  name="weight"
                  value={formData.weight || ""}
                  onChange={handleInputChange}
                  required
                  min={2}
                  max={500}
                  step={0.1}
                  placeholder="Enter weight in kg"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white/50 px-4 py-2.5 text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder-slate-500"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Between 2 and 500 kg</p>
              </div>
              <div>
                <label htmlFor="height" className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Height (cm)
                </label>
                <input
                  type="number"
                  id="height"
                  name="height"
                  value={formData.height || ""}
                  onChange={handleInputChange}
                  required
                  min={30}
                  max={300}
                  step={1}
                  placeholder="Enter height in cm"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white/50 px-4 py-2.5 text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder-slate-500"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Between 30 and 300 cm</p>
              </div>
            </div>

            {/* Blood Group */}
            <div>
              <label htmlFor="bloodGroup" className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                Blood Group
              </label>
              <select
                id="bloodGroup"
                name="bloodGroup"
                value={formData.bloodGroup}
                onChange={handleInputChange}
                required
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white/50 px-4 py-2.5 text-slate-900 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100"
              >
                <option value="">Select blood group</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="unknown">I don&apos;t know</option>
              </select>
            </div>

            {/* Allergies */}
            <div>
              <label htmlFor="allergies" className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                Allergies
              </label>
              <input
                type="text"
                id="allergies"
                name="allergies"
                value={formData.allergies || ""}
                onChange={handleInputChange}
                placeholder="List allergies (comma separated)"
                maxLength={500}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white/50 px-4 py-2.5 text-slate-900 placeholder-slate-400 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder-slate-500"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Optional. Max 500 characters, comma separated</p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <Link href="/patient/profile" className="flex-1">
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
