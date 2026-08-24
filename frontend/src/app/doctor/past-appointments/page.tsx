"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Clock,
  History,
  Loader2,
  Users,
  Video,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import Footer from "@/components/Footer";
import {
  getAppointmentHistory,
  getDoctorProfile,
  type Appointment,
  type DoctorProfile,
} from "@/lib/api";
import { Button } from "@/components/ui/button";

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

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeStr: string) {
  const [h = 0, m = 0] = String(timeStr || "").slice(0, 8).split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function DoctorPastAppointmentsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);

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

  const loadPastAppointments = async () => {
    try {
      setAppointmentsLoading(true);
      setAppointmentsError(null);
      const res = await getAppointmentHistory(1, 50);
      setAppointments(res.appointments || []);
    } catch (err) {
      setAppointments([]);
      setAppointmentsError(
        err instanceof Error && err.message
          ? err.message
          : "Unable to load past appointments.",
      );
    } finally {
      setAppointmentsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getDoctorProfile()
      .then((res) => {
        if (cancelled) return;
        setProfile(res.profile);
        loadPastAppointments().catch(() => {});
      })
      .catch(() => {
        if (!cancelled) router.replace("/auth/doctor");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <DashboardLayout
        navItems={doctorNav}
        userName="Doctor"
        userInitial="D"
        role="doctor"
        theme={theme}
        onToggleTheme={handleThemeToggle}
        footer={<Footer />}
      >
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
        </div>
      </DashboardLayout>
    );
  }

  const userName = profile?.full_name || "Doctor";
  const userInitial = userName.charAt(0).toUpperCase();

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
        <motion.div
          {...sectionAnim}
          className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <h1 className="mb-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
            Past Appointments
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Review completed and cancelled appointments for your account.
          </p>
        </motion.div>

        <motion.div
          {...sectionAnim}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-xl border border-slate-200/80 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-500/20">
              <History className="h-6 w-6 text-sky-600 dark:text-sky-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Appointment History
            </h2>
          </div>

          {appointmentsLoading ? (
            <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-8 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading past appointments...
            </div>
          ) : appointmentsError ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-800">
              <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-amber-500" />
              <p className="font-medium text-slate-600 dark:text-slate-400">
                {appointmentsError}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => loadPastAppointments().catch(() => {})}
              >
                Retry
              </Button>
            </div>
          ) : appointments.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-800">
              <History className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-slate-600" />
              <p className="font-medium text-slate-600 dark:text-slate-400">
                No past appointments found.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt) => {
                const status = (appt.status || "").toLowerCase();
                const statusClass =
                  status === "completed"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                    : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300";

                return (
                  <div
                    key={appt.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {appt.patient_name || "Patient"}
                      </p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass}`}>
                        {status || "unknown"}
                      </span>
                    </div>

                    <p className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Calendar className="h-3.5 w-3.5" /> {formatDate(appt.appointment_date)}
                      <Clock className="ml-2 h-3.5 w-3.5" /> {formatTime(appt.appointment_time)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
