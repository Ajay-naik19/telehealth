"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Calendar, LogOut, Moon, Stethoscope, Sun, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import {
  getAdminAppointments,
  getAdminDashboardStats,
  getAdminDoctors,
  getAdminPatients,
  logout,
  type AdminAppointmentListItem,
  type AdminDashboardStats,
  type AdminDoctorListItem,
  type AdminPatientListItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";

function statTileStyle(theme: "light" | "dark") {
  return theme === "dark"
    ? "rounded-xl border border-border bg-card p-4"
    : "rounded-xl border border-slate-300 bg-white p-4";
}

function statusBadge(status: string) {
  if (status === "completed") return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
  if (status === "scheduled") return "bg-sky-500/15 text-sky-500 border-sky-500/30";
  if (status === "started") return "bg-amber-500/15 text-amber-500 border-amber-500/30";
  return "bg-slate-500/15 text-slate-400 border-slate-500/30";
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [doctors, setDoctors] = useState<AdminDoctorListItem[]>([]);
  const [patients, setPatients] = useState<AdminPatientListItem[]>([]);
  const [appointments, setAppointments] = useState<AdminAppointmentListItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const initial: "light" | "dark" =
      saved === "light" || saved === "dark"
        ? saved
        : "light";

    document.documentElement.classList.toggle("dark", initial === "dark");
    localStorage.setItem("theme", initial);
    setTheme(initial);
  }, []);

  useEffect(() => {
    // Prevent navigating back to auth/pre-auth pages once admin dashboard is loaded.
    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        const [statsRes, doctorsRes, patientsRes, appointmentsRes] = await Promise.all([
          getAdminDashboardStats(),
          getAdminDoctors(1),
          getAdminPatients(1),
          getAdminAppointments({ page: 1 }),
        ]);

        if (cancelled) return;

        setStats(statsRes);
        setDoctors(doctorsRes.slice(0, 5));
        setPatients(patientsRes.slice(0, 5));
        setAppointments(appointmentsRes.slice(0, 8));
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load admin dashboard";
        toast.error(message);
        router.replace("/admin/auth");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [router]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
    setTheme(next);
  };

  const shellClass =
    theme === "dark"
      ? "min-h-screen bg-background text-foreground"
      : "min-h-screen bg-slate-100 text-slate-900";

  const cardClass = useMemo(() => statTileStyle(theme), [theme]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.replace("/admin/auth");
      router.refresh();
    }
  }

  return (
    <div className={shellClass}>
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        <header className={theme === "dark" ? "mb-4 rounded-2xl border border-border bg-card p-4" : "mb-4 rounded-2xl border border-slate-300 bg-white p-4"}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={theme === "dark" ? "text-xs uppercase tracking-[0.14em] text-muted-foreground" : "text-xs uppercase tracking-[0.14em] text-slate-500"}>
                TeleHealthx Administration
              </p>
              <h1 className={theme === "dark" ? "mt-1 text-2xl font-semibold text-foreground" : "mt-1 text-2xl font-semibold text-slate-900"}>
                Admin Dashboard
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" size="icon" variant="outline" onClick={toggleTheme}>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="destructive" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        {loading ? (
          <div className={theme === "dark" ? "rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground" : "rounded-2xl border border-slate-300 bg-white p-6 text-sm text-slate-700"}>
            Loading admin data...
          </div>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className={cardClass}>
                <p className="text-xs text-muted-foreground">Total Patients</p>
                <div className="mt-2 flex items-center gap-2">
                  <Users className="h-4 w-4 text-sky-500" />
                  <span className="text-2xl font-semibold">{stats?.totalPatients ?? 0}</span>
                </div>
              </div>
              <div className={cardClass}>
                <p className="text-xs text-muted-foreground">Total Doctors</p>
                <div className="mt-2 flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-violet-500" />
                  <span className="text-2xl font-semibold">{stats?.totalDoctors ?? 0}</span>
                </div>
              </div>
              <div className={cardClass}>
                <p className="text-xs text-muted-foreground">Active Appointments</p>
                <div className="mt-2 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-amber-500" />
                  <span className="text-2xl font-semibold">{stats?.activeAppointments ?? 0}</span>
                </div>
              </div>
              <div className={cardClass}>
                <p className="text-xs text-muted-foreground">Orders</p>
                <div className="mt-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-500" />
                  <span className="text-2xl font-semibold">{stats?.totalOrders ?? 0}</span>
                </div>
              </div>
            </section>

            <section className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className={theme === "dark" ? "rounded-2xl border border-border bg-card p-4" : "rounded-2xl border border-slate-300 bg-white p-4"}>
                <h2 className="text-sm font-semibold">Recent Doctors</h2>
                <div className="mt-3 space-y-2">
                  {doctors.map((doctor) => (
                    <div key={doctor.id} className={theme === "dark" ? "rounded-lg border border-border bg-secondary p-3" : "rounded-lg border border-slate-200 bg-slate-50 p-3"}>
                      <p className="text-sm font-medium">{doctor.full_name || `Doctor #${doctor.id}`}</p>
                      <p className="text-xs text-muted-foreground">{doctor.phone} • {doctor.specialization || "General"}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={theme === "dark" ? "rounded-2xl border border-border bg-card p-4" : "rounded-2xl border border-slate-300 bg-white p-4"}>
                <h2 className="text-sm font-semibold">Recent Patients</h2>
                <div className="mt-3 space-y-2">
                  {patients.map((patient) => (
                    <div key={patient.id} className={theme === "dark" ? "rounded-lg border border-border bg-secondary p-3" : "rounded-lg border border-slate-200 bg-slate-50 p-3"}>
                      <p className="text-sm font-medium">{patient.full_name || `Patient #${patient.id}`}</p>
                      <p className="text-xs text-muted-foreground">{patient.phone} • {patient.blood_group || "Blood group N/A"}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className={theme === "dark" ? "mt-4 rounded-2xl border border-border bg-card p-4" : "mt-4 rounded-2xl border border-slate-300 bg-white p-4"}>
              <h2 className="text-sm font-semibold">Appointments</h2>
              <div className="mt-3 grid gap-2">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className={theme === "dark" ? "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary p-3" : "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{appointment.doctor_name || "Doctor"} • {appointment.patient_name || "Patient"}</p>
                      <p className="text-xs text-muted-foreground">
                        {appointment.appointment_date} {String(appointment.appointment_time || "").slice(0, 5)}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadge(appointment.status)}`}>
                      {appointment.status}
                    </span>
                  </div>
                ))}

                {appointments.length === 0 && (
                  <div className={theme === "dark" ? "rounded-lg border border-border bg-secondary p-3 text-sm text-muted-foreground" : "rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"}>
                    No appointments found.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
