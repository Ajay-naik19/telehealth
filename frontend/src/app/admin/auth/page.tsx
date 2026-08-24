"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { adminLogin } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Logo from "@/components/Logo";

export default function AdminAuthPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const initial: "light" | "dark" =
      saved === "light" || saved === "dark" ? saved : "light";

    document.documentElement.classList.toggle("dark", initial === "dark");
    localStorage.setItem("theme", initial);
    setTheme(initial);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function guardAuthenticatedAdmin() {
      try {
        const res = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (!res.ok || cancelled) return;

        const payload = (await res.json()) as {
          success?: boolean;
          data?: {
            authenticated?: boolean;
            user?: { backendRole?: string };
            backendRole?: string;
          } | null;
        };

        const backendRole =
          payload?.data?.user?.backendRole || payload?.data?.backendRole;
        const authenticated = Boolean(payload?.data?.authenticated);

        if (authenticated && backendRole === "admin") {
          router.replace("/admin");
          router.refresh();
        }
      } catch {
        // Ignore and allow manual sign-in.
      }
    }

    guardAuthenticatedAdmin().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!phone.trim() || !password.trim()) {
      toast.error("Enter phone and password.");
      return;
    }

    if (!/^\d{10}$/.test(phone.trim())) {
      toast.error("Phone number must be exactly 10 digits.");
      return;
    }

    try {
      setLoading(true);
      await adminLogin(phone.trim(), password);
      toast.success("Admin login successful.");
      router.replace("/admin");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to login";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const shellClass =
    theme === "dark"
      ? "min-h-screen bg-background text-foreground"
      : "min-h-screen bg-slate-100 text-slate-900";

  const cardClass =
    theme === "dark"
      ? "w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl backdrop-blur"
      : "w-full max-w-md rounded-2xl border border-slate-300 bg-white p-6 shadow-xl";

  return (
    <div className={shellClass}>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-8">
        <div className={cardClass}>
          <div className="mb-6 text-center">
            <div className="mb-4 flex justify-center">
              <Logo size="lg" />
            </div>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1
              className={
                theme === "dark"
                  ? "text-2xl font-semibold text-white"
                  : "text-2xl font-semibold text-slate-900"
              }
            >
              Admin Access
            </h1>
            <p
              className={
                theme === "dark"
                  ? "mt-2 text-sm text-muted-foreground"
                  : "mt-2 text-sm text-slate-600"
              }
            >
              Sign in to manage platform operations.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-2">
              <label
                className={
                  theme === "dark"
                    ? "text-xs font-medium text-slate-300"
                    : "text-xs font-medium text-slate-700"
                }
              >
                Phone
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="Enter admin phone"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  className={
                    theme === "dark"
                      ? "h-11 border-border bg-secondary pl-9 text-foreground"
                      : "h-11 border-slate-300 bg-slate-50 pl-9 text-slate-900"
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                className={
                  theme === "dark"
                    ? "text-xs font-medium text-slate-300"
                    : "text-xs font-medium text-slate-700"
                }
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  className={
                    theme === "dark"
                      ? "hide-password-reveal h-11 border-border bg-secondary pl-9 pr-10 text-foreground"
                      : "hide-password-reveal h-11 border-slate-300 bg-slate-50 pl-9 pr-10 text-slate-900"
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="h-11 w-full">
              {loading ? "Signing in..." : "Sign in as Admin"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
