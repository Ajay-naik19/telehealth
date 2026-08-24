"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Phone,
  Lock,
  ArrowRight,
  AlertCircle,
  Stethoscope,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { resolvePostLoginRoute } from "@/services/auth.client";
import { ApiError } from "@/lib/api";

type AuthMode = "login" | "signup";
type Role = "patient" | "doctor";

interface AuthCardProps {
  role: Role;
}

export default function AuthCard({ role }: AuthCardProps) {
  const router = useRouter();
  const auth = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handlePhoneInput = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    let val = input.value.replace(/\D/g, "");
    if (val.length > 10) val = val.slice(0, 10);
    input.value = val;
  };

  const isLogin = mode === "login";
  const isDoctor = role === "doctor";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((v, k) => { data[k] = v as string; });

    // Add country code if not present
    const digitsOnly = (data.phone || "").replace(/\D/g, "");
    if (digitsOnly.length !== 10) {
      setError("Phone number must be exactly 10 digits.");
      setLoading(false);
      return;
    }
    data.phone = `+91${digitsOnly}`;

    // Signup: ensure passwords match
    if (!isLogin) {
      if (data.password !== data.confirmpassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }
    }

    try {
      const authUser = isLogin
        ? await auth.login(role, data.phone, data.password)
        : await auth.signup(role, data.phone, data.password, data.confirmpassword);

      const redirectPath = resolvePostLoginRoute(authUser);
      await auth.refreshSession();

      router.replace(redirectPath);
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || (isLogin ? "Invalid credentials." : "Registration failed."));
      } else if (err instanceof Error && err.name === "AbortError") {
        setError("Server is waking up. Please wait a moment and try again.");
      } else {
        setError("Something went wrong.");
      }
      setLoading(false);
    }
  };

  const handleModeChange = (m: AuthMode) => {
    setMode(m);
    setError("");
    setSuccessMsg("");
    setShowPassword(false);
    setShowConfirm(false);
  };

  const inputClasses =
    "h-12 rounded-xl border border-slate-200 bg-slate-50/60 pl-10 text-[15px] text-slate-900 shadow-sm transition-all duration-250 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800 dark:focus:ring-sky-500/20";

  const formKey = `${role}-${mode}`;

  return (
    <div className="card w-full max-w-175 overflow-hidden shadow-xl shadow-slate-200/40 dark:shadow-slate-950/30">
      <div className="flex flex-col md:flex-row">
        {/* Left panel — info */}
        <div className="auth-hero-bg flex flex-col justify-center p-8 text-white md:w-65 md:p-10">
          <div className="icon-box mb-6 flex h-12 w-12 items-center justify-center">
            {isDoctor ? (
              <Stethoscope className="h-6 w-6" />
            ) : (
              <Heart className="h-6 w-6" />
            )}
          </div>

          <div>
              <h2 className="font-heading text-[24px] font-bold leading-tight text-white">
                {isLogin ? "Welcome Back" : "Create Your Account"}
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-blue-100">
                {isLogin
                  ? "Login to continue your TeleHealthx journey."
                  : "Join our platform to connect with certified doctors."}
              </p>
          </div>

          <div className="mt-8 flex items-center gap-2 text-[13px] text-sky-200">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Secure & HIPAA Compliant
          </div>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 p-8 md:p-10">
          {/* Toggle */}
          <div className="relative mb-8 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {(["login", "signup"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleModeChange(opt)}
                className={`relative z-10 flex-1 rounded-lg py-2.5 text-[14px] font-semibold transition-colors duration-200 ${
                  mode === opt
                    ? "text-sky-700 dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:text-white/85 dark:hover:text-white"
                }`}
              >
                {opt === "login" ? "Login" : "Sign Up"}
              </button>
            ))}
            <div
              className="absolute inset-y-1 z-0 rounded-lg bg-white shadow-sm ring-1 ring-slate-200/50 dark:bg-slate-700 dark:ring-slate-600"
              style={{
                width: "calc(50% - 4px)",
                left: mode === "login" ? "4px" : "calc(50%)",
              }}
            />
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
              {/* Phone */}
              <div>
                <Label htmlFor="phone" className="text-[12px] font-bold text-slate-500 dark:text-white">
                  Phone Number
                </Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="e.g. 9876543210"
                    onInput={handlePhoneInput}
                    className={inputClasses}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <Label htmlFor="password" className="text-[12px] font-bold text-slate-500 dark:text-white">
                  Password
                </Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Enter password"
                    className={`${inputClasses} pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-credentials-auto-fill-button]:hidden`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password (signup only) */}
              {!isLogin && (
                <div>
                  <Label htmlFor="confirmpassword" className="text-[12px] font-bold text-slate-500 dark:text-white">
                    Confirm Password
                  </Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <Input
                      id="confirmpassword"
                      name="confirmpassword"
                      type={showConfirm ? "text" : "password"}
                      required
                      placeholder="Confirm password"
                      className={`${inputClasses} pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-credentials-auto-fill-button]:hidden`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Success */}
              {successMsg && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {successMsg}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full text-[16px] font-semibold"
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    {isLogin ? "Sign In" : "Create Account"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
