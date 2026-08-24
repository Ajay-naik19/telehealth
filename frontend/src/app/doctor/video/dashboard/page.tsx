"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Clock,
  Loader2,
  Users,
  Video,
  X,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import {
  cancelAppointment as apiCancelAppointment,
  getDoctorProfile,
  getDoctorAllAppointments,
  startAppointment,
  type DoctorProfile,
  type DoctorActiveAppointment,
} from "@/lib/api";
import { toast } from "sonner";
import Footer from "@/components/Footer";
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

function toLocalStartTimeMs(appointmentDate: string, appointmentTime: string) {
  const datePart = String(appointmentDate || "").slice(0, 10);
  const timePart = String(appointmentTime || "").slice(0, 8);

  const [y, m, d] = datePart.split("-").map(Number);
  const [hh = 0, mm = 0, ss = 0] = timePart.split(":").map(Number);

  if (!y || !m || !d) return Number.NaN;
  return new Date(y, m - 1, d, hh, mm, ss).getTime();
}

function formatDisplayTime(appointmentTime: string) {
  const timePart = String(appointmentTime || "").slice(0, 8);
  const [hh = 0, mm = 0] = timePart.split(":").map(Number);
  const ampm = hh >= 12 ? "PM" : "AM";
  const hr = hh % 12 || 12;
  return `${hr}:${String(mm).padStart(2, "0")} ${ampm}`;
}

function formatDisplayDate(appointmentDate: string, appointmentTime: string) {
  const ms = toLocalStartTimeMs(appointmentDate, appointmentTime);
  if (!Number.isFinite(ms)) return String(appointmentDate || "").slice(0, 10);
  return new Date(ms).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DocVideoDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [appointments, setAppointments] = useState<DoctorActiveAppointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [startingAppointmentId, setStartingAppointmentId] = useState<number | null>(null);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<number | null>(null);

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

  const loadAppointments = async () => {
    try {
      const res = await getDoctorAllAppointments();
      setAppointments(res.appointments || []);
    } catch {
      setAppointments([]);
      toast.error("Unable to load appointments right now.");
    } finally {
      setAppointmentsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getDoctorProfile()
      .then((res) => {
        if (!cancelled) setProfile(res.profile);
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

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!profile) return;
      if (!cancelled) setAppointmentsLoading(true);
      await loadAppointments();
    };

    run();

    const timer = setInterval(() => {
      if (profile && !cancelled) {
        loadAppointments().catch(() => {});
      }
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [profile]);

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
          <Activity className="h-8 w-8 animate-spin text-sky-500" />
        </div>
      </DashboardLayout>
    );
  }

  const userName = profile?.full_name || "Doctor";
  const userInitial = userName.charAt(0).toUpperCase();

  const sortedAppointments = [...appointments].sort((a, b) => {
    const aTime = toLocalStartTimeMs(a.appointment_date, a.appointment_time);
    const bTime = toLocalStartTimeMs(b.appointment_date, b.appointment_time);

    if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) return 0;
    if (!Number.isFinite(aTime)) return 1;
    if (!Number.isFinite(bTime)) return -1;

    return aTime - bTime;
  });

  const nowMs = Date.now();
  const upcomingAppointments = sortedAppointments
    .filter((appt) => {
      if (appt.status !== "scheduled" && appt.status !== "started") return false;
      if (appt.status === "started") return true;

      const startMs = toLocalStartTimeMs(appt.appointment_date, appt.appointment_time);
      if (!Number.isFinite(startMs)) {
        // Keep scheduled rows visible if datetime parsing fails.
        return true;
      }

      return startMs >= nowMs;
    });

  const firstUpcomingAppointment = upcomingAppointments[0] || null;
  const hasInProgressAppointment = upcomingAppointments.some((appt) => appt.status === "started");

  const getStartBlockReason = (appt: DoctorActiveAppointment, queueIndex: number) => {
    if (queueIndex !== 0) {
      return "Only the first appointment in the queue can be started.";
    }

    if (appt.status === "started") {
      if (!appt.room_id) return "Call room is not ready yet. Refresh and try again.";
      return null;
    }

    if (appt.status !== "scheduled") {
      return "Only scheduled appointments can be started.";
    }

    if (hasInProgressAppointment) {
      return "Another appointment is already in progress. Complete it first.";
    }

    const startMs = toLocalStartTimeMs(appt.appointment_date, appt.appointment_time);
    if (!Number.isFinite(startMs)) {
      return "Invalid appointment time. Please refresh and try again.";
    }

    const earliestAllowedMs = startMs - 10 * 60 * 1000;
    if (nowMs < earliestAllowedMs) {
      return "Doctor can start call only within 10 minutes before scheduled time.";
    }

    return null;
  };

  const handleStartCall = async (appointmentId: number) => {
    try {
      setStartingAppointmentId(appointmentId);
      const res = await startAppointment(appointmentId);
      toast.success("Call started. Opening setup checks...");
      router.push(`/doctor/video/setup/${res.roomId}`);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Unable to start call right now.";
      toast.error(message);
      await loadAppointments();
    } finally {
      setStartingAppointmentId(null);
    }
  };

  const handleJoinCall = (roomId: string) => {
    router.push(`/doctor/video/setup/${roomId}`);
  };

  const handleCancelAppointment = async (appointmentId: number) => {
    const reason = window.prompt("Reason for cancellation (optional):") || undefined;

    try {
      setCancellingAppointmentId(appointmentId);
      await apiCancelAppointment(appointmentId, reason?.trim() || undefined);
      toast.success("Appointment cancelled successfully.");
      await loadAppointments();
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Unable to cancel appointment right now.";
      toast.error(message);
    } finally {
      setCancellingAppointmentId(null);
    }
  };

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
          <h1 className="mb-2 text-3xl font-bold text-slate-900 dark:text-white">
            Video Consultation Dashboard
          </h1>
          <p className="text-slate-600 dark:text-white">
            Start and manage your virtual consultations with patients
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <motion.div
            {...sectionAnim}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-xl border border-slate-200/80 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-500/20">
                <Video className="h-6 w-6 text-sky-600 dark:text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Your Appointment
              </h2>
            </div>

            {appointmentsLoading ? (
              <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-8 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading first appointment...
              </div>
            ) : !firstUpcomingAppointment ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-800">
                <Calendar className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-white" />
                <p className="font-medium text-slate-600 dark:text-white">
                  No upcoming appointments. Appointments will appear here.
                </p>
              </div>
            ) : (() => {
              const appt = firstUpcomingAppointment;
              const dateText = formatDisplayDate(appt.appointment_date, appt.appointment_time);
              const timeText = formatDisplayTime(appt.appointment_time);
              const isStarted = appt.status === "started";
              const canJoin = isStarted && !!appt.room_id;
              const isStarting = startingAppointmentId === appt.id;
              const isCancelling = cancellingAppointmentId === appt.id;
              const blockReason = getStartBlockReason(appt, 0);

              return (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-base font-semibold text-slate-900 dark:text-white">
                        {appt.user_name || "Patient"}
                      </p>
                      <span
                        className={[
                          "rounded-full px-3 py-1 text-xs font-semibold capitalize",
                          isStarted
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-white"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-white",
                        ].join(" ")}
                      >
                        {isStarted ? "Started" : "Scheduled"}
                      </span>
                    </div>

                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-600 dark:text-white">
                      <Calendar className="h-4 w-4" /> {dateText}
                      <Clock className="ml-2 h-4 w-4" /> {timeText}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Patient Details</h3>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700 dark:text-white">
                      <p>Gender: {appt.gender || "-"}</p>
                      <p>Blood Group: {appt.blood_group || "-"}</p>
                      <p>Weight: {appt.weight_kg ?? "-"} kg</p>
                      <p>Height: {appt.height_cm ?? "-"} cm</p>
                    </div>

                    {appt.allergies ? (
                      <p className="mt-2 text-sm text-slate-700 dark:text-white">
                        Allergies: {appt.allergies}
                      </p>
                    ) : null}

                    {appt.symptoms ? (
                      <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-white">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{appt.symptoms}</span>
                      </div>
                    ) : null}
                  </div>

                  {blockReason ? (
                    <p className="text-xs text-amber-700 dark:text-white">{blockReason}</p>
                  ) : null}

                  <div className="space-y-2">
                    {canJoin ? (
                      <Button
                        className="w-full"
                        onClick={() => handleJoinCall(appt.room_id as string)}
                      >
                        <Video className="mr-2 h-4 w-4" />
                        Join Video Call
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleStartCall(appt.id)}
                        disabled={isStarting || !!blockReason}
                      >
                        {isStarting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Video className="mr-2 h-4 w-4" />
                        )}
                        {isStarting ? "Starting..." : "Start Video Call"}
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      className="w-full border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-white dark:hover:bg-red-900/20"
                      onClick={() => handleCancelAppointment(appt.id)}
                      disabled={isCancelling || isStarted}
                    >
                      {isCancelling ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <X className="mr-2 h-4 w-4" />
                      )}
                      {isCancelling ? "Cancelling..." : "Cancel Appointment"}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </motion.div>

          <motion.div
            {...sectionAnim}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="rounded-xl border border-slate-200/80 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-500/20">
                <Calendar className="h-6 w-6 text-sky-600 dark:text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                List of All Appointments
              </h2>
            </div>

            {appointmentsLoading ? (
              <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-8 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading appointments...
              </div>
            ) : sortedAppointments.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-800">
                <Calendar className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-white" />
                <p className="font-medium text-slate-600 dark:text-white">
                  No appointments found.
                </p>
              </div>
            ) : (
              <div className="max-h-96 space-y-3 overflow-y-auto pr-2">
                {sortedAppointments.map((appt) => {
                  const isStarted = appt.status === "started";
                  const dateText = formatDisplayDate(appt.appointment_date, appt.appointment_time);
                  const timeText = formatDisplayTime(appt.appointment_time);

                  return (
                    <div
                      key={appt.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {appt.user_name || "Patient"}
                        </p>
                        <span
                          className={[
                            "rounded-full px-3 py-1 text-xs font-semibold capitalize",
                            isStarted
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-white"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-white",
                          ].join(" ")}
                        >
                          {isStarted ? "Started" : "Scheduled"}
                        </span>
                      </div>

                      <p className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-white">
                        <Calendar className="h-3.5 w-3.5" /> {dateText}
                        <Clock className="ml-2 h-3.5 w-3.5" /> {timeText}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}

