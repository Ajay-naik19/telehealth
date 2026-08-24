"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  Calendar,
  Video,
  Pill,
  FileText,
  Stethoscope,
  Loader2,
  Clock,
  CheckCircle2,
  CalendarX,
  Download,
  AlertCircle,
  XCircle,
  User,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  getUserProfile,
  getUserActiveAppointment,
  cancelAppointment as apiCancelAppointment,
  getRecentPrescription,
  type UserProfile,
  type ActiveAppointment,
  ApiError,
} from "@/lib/api";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/backend";

const patientNav: NavItem[] = [
  { href: "/patient/home", label: "Home", icon: Activity },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/patient/video/dashboard", label: "Video Consult", icon: Video },
  { href: "/pharmacy", label: "Pharmacy", icon: Pill },
  { href: "/records", label: "My Records", icon: FileText },
];

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export default function UserVideoDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [appointment, setAppointment] = useState<ActiveAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

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

  // Cancel modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Prescription download
  const [downloading, setDownloading] = useState(false);

  const userName = profile?.full_name?.split(" ")[0] || "Patient";
  const userInitial = userName.charAt(0).toUpperCase();

  const loadData = useCallback(async () => {
    try {
      const [profileRes, activeRes] = await Promise.allSettled([
        getUserProfile(),
        getUserActiveAppointment(),
      ]);

      if (profileRes.status === "fulfilled") setProfile(profileRes.value.profile);
      else router.replace("/auth/patient");

      if (activeRes.status === "fulfilled") setAppointment(activeRes.value.appointment);
    } catch {
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll for real-time appointment updates every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      getUserActiveAppointment()
        .then((res) => {
          const updated = res.appointment;
          setAppointment((prev) => {
            if (!prev && updated) return updated;
            if (prev && !updated) {
              toast.info("Your appointment status has changed.");
              return null;
            }
            if (prev && updated && prev.status !== updated.status) {
              if (updated.status === "started") {
                toast.success("Your doctor has started the video call!");
              } else if (updated.status === "cancelled") {
                toast.error("Your appointment has been cancelled by the doctor.");
              } else if (updated.status === "completed") {
                toast.info("Your appointment has been completed.");
              }
            }
            return updated;
          });
        })
        .catch(() => {});
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  /* ── Cancel appointment ── */
  async function handleCancel() {
    if (!appointment) return;
    setCancelling(true);
    try {
      await apiCancelAppointment(appointment.id, cancelReason || undefined);
      toast.success("Your appointment has been cancelled.");
      setAppointment(null);
      setCancelModalOpen(false);
      setCancelReason("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to cancel appointment.");
    } finally {
      setCancelling(false);
    }
  }

  /* ── Download recent prescription ── */
  async function handleDownloadPrescription() {
    setDownloading(true);
    try {
      const data = await getRecentPrescription();
      const res = await fetch(`${API_BASE}/api/prescription/download/${data.appointment.room_id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to download prescription");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Prescription_${data.appointment.room_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Prescription downloaded successfully!");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "No recent prescription available to download.",
      );
    } finally {
      setDownloading(false);
    }
  }

  /* ── Status helpers ── */
  const hasAppointment = !!appointment;
  const isStarted = appointment?.status === "started";
  const isScheduled = appointment?.status === "scheduled";

  function getStatusConfig() {
    if (!hasAppointment) {
      return {
        icon: <CalendarX className="h-5 w-5" />,
        text: "No active appointments.",
        color: "text-slate-500 dark:text-slate-300",
        bg: "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700",
        border: "border-l-slate-400 dark:border-l-slate-500",
      };
    }
    if (isStarted) {
      return {
        icon: <CheckCircle2 className="h-5 w-5" />,
        text: "Doctor has started the call",
        color: "text-emerald-600 dark:text-emerald-300",
        bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/40",
        border: "border-l-emerald-500",
      };
    }
    return {
      icon: <Clock className="h-5 w-5 animate-pulse" />,
      text: "Waiting for doctor to start the call...",
      color: "text-amber-600 dark:text-amber-300",
      bg: "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/40",
      border: "border-l-amber-500",
    };
  }

  const status = getStatusConfig();

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
      {/* Page Header */}
      <motion.div {...fadeUp} className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
          Video Consultation Dashboard
        </h1>
        <p className="mt-2 text-[15px] text-slate-500 dark:text-slate-300">
          Join your scheduled virtual appointments with healthcare professionals
        </p>
      </motion.div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[15px] text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Appointment Card */}
        <motion.div
          {...fadeUp}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {/* Card Header */}
          <div className="flex items-center gap-4 border-b border-slate-100 p-6 dark:border-slate-700">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 shadow-md shadow-sky-200/40 dark:bg-sky-500 dark:shadow-none">
              <User className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Your Appointment</h2>
          </div>

          <div className="p-6">
            {/* Info Rows */}
            <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-700">
              <div className="flex items-center justify-between py-3">
                <span className="text-[14px] font-medium text-slate-500 dark:text-slate-300">Doctor</span>
                <span className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                  {hasAppointment
                    ? `${appointment.doctor_name} (${appointment.specialization})`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-[14px] font-medium text-slate-500 dark:text-slate-300">Date</span>
                <span className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                  {hasAppointment
                    ? new Date(appointment.appointment_date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-[14px] font-medium text-slate-500 dark:text-slate-300">Time</span>
                <span className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                  {hasAppointment ? appointment.appointment_time : "—"}
                </span>
              </div>
            </div>

            {/* Status Banner */}
            <div
              className={`mt-5 flex items-center gap-3 rounded-xl border border-l-4 p-4 ${status.bg} ${status.border}`}
            >
              <span className={status.color}>{status.icon}</span>
              <p className={`text-[15px] font-semibold ${status.color}`}>{status.text}</p>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 space-y-3">
              {isStarted && appointment.room_id ? (
                <Button
                  className="w-full py-6 text-[15px] font-semibold"
                  onClick={() => router.push(`/patient/video/setup/${appointment.room_id}`)}
                >
                  <Video className="mr-2 h-5 w-5" />
                  Join Video Call
                </Button>
              ) : (
                <Button
                  className="w-full rounded-xl py-6 text-[15px] font-semibold"
                  disabled
                >
                  <Video className="mr-2 h-5 w-5" />
                  Join Video Call
                </Button>
              )}

              {isScheduled && (
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-red-200 py-5 text-[14px] font-semibold text-red-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                  onClick={() => setCancelModalOpen(true)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Appointment
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Prescription Card */}
        <motion.div
          {...fadeUp}
          transition={{ delay: 0.15 }}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {/* Card Header */}
          <div className="flex items-center gap-4 border-b border-slate-100 p-6 dark:border-slate-700">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 shadow-md shadow-sky-200/40 dark:bg-sky-500 dark:shadow-none">
              <FileText className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Missed Your Prescription?</h2>
          </div>

          <div className="p-6">
            <p className="mb-6 text-[15px] leading-relaxed text-slate-500 dark:text-slate-300">
              If you missed downloading your prescription after your last consultation,
              you can download it here.
            </p>

            <Button
              className="w-full py-6 text-[15px] font-semibold"
              onClick={handleDownloadPrescription}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Download className="mr-2 h-5 w-5" />
              )}
              {downloading ? "Downloading..." : "Download Prescription"}
            </Button>

            {/* Instructions */}
            <div className="mt-8 space-y-4">
              <h3 className="flex items-center gap-2 text-[16px] font-semibold text-slate-800">
                <Stethoscope className="h-5 w-5 text-sky-500" />
                <span className="dark:text-slate-100">How It Works</span>
              </h3>
              {[
                {
                  step: 1,
                  title: "Wait for your doctor",
                  desc: "Your doctor will start the call when ready.",
                },
                {
                  step: 2,
                  title: "Join the video call",
                  desc: "Click the join button once the call is active.",
                },
                {
                  step: 3,
                  title: "Get your prescription",
                  desc: "Download it after the consultation ends.",
                },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[13px] font-bold text-white dark:bg-sky-500">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
                    <p className="text-[13px] text-slate-500 dark:text-slate-300">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Cancel Appointment Dialog */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="rounded-2xl bg-white dark:bg-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100">
              <CalendarX className="h-5 w-5 text-red-500" />
              Cancel Appointment
            </DialogTitle>
            <DialogDescription className="text-[14px] text-slate-500 dark:text-slate-300">
              Are you sure you want to cancel this appointment?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <label className="mb-2 block text-[14px] font-medium text-slate-700 dark:text-slate-200">
              Reason (optional)
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-[14px] text-slate-800 outline-none transition-colors focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800"
              rows={3}
              placeholder="Please provide a reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose
              render={(
                <Button
                  variant="outline"
                  className="rounded-xl text-[14px]"
                />
              )}
            >
              Keep Appointment
            </DialogClose>
            <Button
              className="rounded-xl bg-red-500 text-[14px] font-semibold text-white hover:bg-red-600"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              {cancelling ? "Cancelling..." : "Cancel Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
