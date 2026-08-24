"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
  ChevronLeft,
  ChevronRight,
  Clock,
  UserRound,
  Check,
  ArrowRightLeft,
  Lock,
  CalendarCheck,
  CalendarX,
  ClipboardList,
  Hourglass,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Download,
  History,
  CalendarPlus,
  Info,
  MousePointerClick,
  X,
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
  getAvailableDoctors,
  getAvailableSlots,
  lockSlot,
  unlockSlot,
  bookAppointment,
  rescheduleAppointment,
  getUpcomingAppointments,
  getAppointmentHistory,
  cancelAppointment as apiCancelAppointment,
  type UserProfile,
  type AvailableDoctor,
  type TimeSlot,
  type Appointment,
  ApiError,
} from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/backend";

const patientNav: NavItem[] = [
  { href: "/patient/home", label: "Home", icon: Activity },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/patient/video/dashboard", label: "Video Consult", icon: Video },
  { href: "/pharmacy", label: "Pharmacy", icon: Pill },
  { href: "/records", label: "My Records", icon: FileText },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const sectionAnim = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const REQUEST_TIMEOUT_MS = 70000;

function formatDateForAPI(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateDisplay(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function formatTime24to12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

/* ================================================================
   COMPONENT
   ================================================================ */
export default function AppointmentsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
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

  // Booking wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [doctors, setDoctors] = useState<AvailableDoctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<AvailableDoctor | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [lockToken, setLockToken] = useState<string | null>(null);
  const [lockExpiry, setLockExpiry] = useState<number>(0);
  const [lockDisplay, setLockDisplay] = useState("5:00");
  const [lockExpiring, setLockExpiring] = useState(false);
  const [symptoms, setSymptoms] = useState("");
  const [booking, setBooking] = useState(false);

  // Appointments lists
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [upcomingError, setUpcomingError] = useState<string | null>(null);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  // Cancel modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Reschedule state
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);

  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockTokenRef = useRef<string | null>(null);
  const selectedDoctorRef = useRef<AvailableDoctor | null>(null);
  const selectedDateRef = useRef<Date | null>(null);
  const selectedTimeRef = useRef<string | null>(null);

  const withTimeout = useCallback(async <T,>(promise: Promise<T>, message: string) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race<T>([
        promise,
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(message)), REQUEST_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }, []);

  // Keep refs in sync for cleanup
  useEffect(() => { lockTokenRef.current = lockToken; }, [lockToken]);
  useEffect(() => { selectedDoctorRef.current = selectedDoctor; }, [selectedDoctor]);
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);
  useEffect(() => { selectedTimeRef.current = selectedTime; }, [selectedTime]);

  /* ── Auth ── */
  useEffect(() => {
    let cancelled = false;
    withTimeout(getUserProfile(), "Profile request timed out")
      .then((res) => { if (!cancelled) setProfile(res.profile); })
      .catch(() => {
        if (!cancelled) {
          setProfile(null);
          setDoctors([]);
          setUpcoming([]);
          setHistory([]);
          setDoctorsLoading(false);
          setUpcomingLoading(false);
          setHistoryLoading(false);
          setDoctorsError("Unable to load profile/session. Please login again.");
          setUpcomingError("Unable to load profile/session. Please login again.");
          setHistoryError("Unable to load profile/session. Please login again.");
          router.replace("/auth/patient");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withTimeout]);

  /* ── Load doctors ── */
  const loadDoctors = useCallback(() => {
    setDoctorsLoading(true);
    setDoctorsError(null);
    withTimeout(getAvailableDoctors(), "Doctors request timed out")
      .then((doctors) => setDoctors(doctors || []))
      .catch((err) => {
        setDoctors([]);
        setDoctorsError((err as Error).message || "Unable to load doctors");
      })
      .finally(() => setDoctorsLoading(false));
  }, [withTimeout]);

  useEffect(() => {
    if (profile) loadDoctors();
  }, [profile, loadDoctors]);

  /* ── Load upcoming & history ── */
  const loadUpcoming = useCallback(() => {
    setUpcomingLoading(true);
    setUpcomingError(null);
    withTimeout(getUpcomingAppointments(1, 50), "Upcoming appointments request timed out")
      .then((res) => setUpcoming(res.appointments || []))
      .catch((err) => {
        setUpcoming([]);
        setUpcomingError((err as Error).message || "Unable to load upcoming appointments");
      })
      .finally(() => setUpcomingLoading(false));
  }, [withTimeout]);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    setHistoryError(null);
    withTimeout(getAppointmentHistory(historyPage, 10), "Appointment history request timed out")
      .then((res) => {
        setHistory(res.appointments || []);
        setHistoryTotalPages((res as { totalPages?: number }).totalPages || 1);
      })
      .catch((err) => {
        setHistory([]);
        setHistoryError((err as Error).message || "Unable to load appointment history");
      })
      .finally(() => setHistoryLoading(false));
  }, [historyPage, withTimeout]);

  useEffect(() => { if (profile) loadUpcoming(); }, [profile, loadUpcoming]);
  useEffect(() => { if (profile) loadHistory(); }, [profile, loadHistory]);

  /* ── Load slots when date changes ── */
  useEffect(() => {
    if (!selectedDoctor || !selectedDate) return;
    setSlotsLoading(true);
    getAvailableSlots(selectedDoctor.id, formatDateForAPI(selectedDate))
      .then((slots) => setSlots(slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDoctor, selectedDate]);

  /* ── Lock timer ── */
  function startLockTimer(expiryMs: number) {
    if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    const expiry = Date.now() + expiryMs;
    setLockExpiry(expiry);
    setLockExpiring(false);

    lockTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, expiry - Date.now());
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setLockDisplay(`${mins}:${String(secs).padStart(2, "0")}`);
      setLockExpiring(remaining <= 60000);

      if (remaining <= 0) {
        if (lockTimerRef.current) clearInterval(lockTimerRef.current);
        setLockDisplay("0:00");
        setLockToken(null);
        toast.warning("Your slot reservation has expired. Please select a new time slot.");
        setTimeout(() => {
          setCurrentStep(2);
          setSelectedTime(null);
        }, 1500);
      }
    }, 250);
  }

  /* ── Release lock ── */
  async function releaseLock() {
    const tok = lockTokenRef.current;
    const doc = selectedDoctorRef.current;
    const date = selectedDateRef.current;
    const time = selectedTimeRef.current;
    if (!tok || !doc || !date || !time) return;
    try {
      await unlockSlot(doc.id, formatDateForAPI(date), time, tok);
    } catch {
      // best effort
    }
  }

  /* Cleanup on unmount */
  useEffect(() => {
    const handleBeforeUnload = () => {
      const tok = lockTokenRef.current;
      const doc = selectedDoctorRef.current;
      const date = selectedDateRef.current;
      const time = selectedTimeRef.current;
      if (tok && doc && date && time) {
        const body = JSON.stringify({
          doctorId: doc.id,
          date: formatDateForAPI(date),
          time,
          lockToken: tok,
        });
        navigator.sendBeacon(
          `${API_BASE}/api/slots/unlock`,
          new Blob([body], { type: "application/json" }),
        );
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (lockTimerRef.current) clearInterval(lockTimerRef.current);
      releaseLock();
    };
  }, []);

  /* ── Doctor selection ── */
  function handleSelectDoctor(doc: AvailableDoctor) {
    setSelectedDoctor(doc);
    setSelectedDate(null);
    setSelectedTime(null);
    setSlots([]);
    setTimeout(() => setCurrentStep(2), 200);
  }

  function handleChangeDoctor() {
    releaseLock();
    if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    setLockToken(null);
    setSelectedDoctor(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setSlots([]);
    setCurrentStep(1);
  }

  /* ── Date click ── */
  function handleDateClick(date: Date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    if (d < tomorrow) return; // 24hr advance rule
    setSelectedDate(date);
    setSelectedTime(null);
  }

  /* ── Slot click ── */
  async function handleSlotClick(time: string) {
    if (!selectedDoctor || !selectedDate) return;
    setSelectedTime(time);

    try {
      const res = await lockSlot(selectedDoctor.id, formatDateForAPI(selectedDate), time);
      setLockToken(res.lockToken);
      startLockTimer(5 * 60 * 1000);
      setCurrentStep(3);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.warning("This slot is currently locked by another patient. Please choose a different time.");
      } else {
        toast.error((err as Error).message || "Failed to reserve slot. Please try again.");
      }
      setSelectedTime(null);
      // Reload slots
      setSlotsLoading(true);
      getAvailableSlots(selectedDoctor.id, formatDateForAPI(selectedDate))
        .then((slots) => setSlots(slots || []))
        .catch(() => setSlots([]))
        .finally(() => setSlotsLoading(false));
    }
  }

  /* ── Confirm booking ── */
  async function handleConfirmBooking() {
    if (!selectedDoctor || !selectedDate || !selectedTime || !lockToken) return;

    const hasExistingActiveAppointment = upcoming.some((appt) => {
      const status = (appt.status || "").toLowerCase();
      return status === "scheduled" || status === "started";
    });

    if (!rescheduleId && hasExistingActiveAppointment) {
      toast.warning("You already have an active appointment. Please complete it before booking a new one.");
      return;
    }

    setBooking(true);

    try {
      const bookingData = {
        doctorId: selectedDoctor.id,
        appointment_date: formatDateForAPI(selectedDate),
        appointment_time: selectedTime,
        lockToken,
        symptoms: symptoms.trim() || undefined,
      };

      if (rescheduleId) {
        await withTimeout(
          rescheduleAppointment(rescheduleId, bookingData),
          "Reschedule request timed out. Please try again.",
        );
        toast.success("Your appointment has been rescheduled!");
        setRescheduleId(null);
      } else {
        await withTimeout(
          bookAppointment(bookingData),
          "Booking request timed out. Please try again.",
        );
        toast.success("Your appointment has been booked!");
      }

      if (lockTimerRef.current) clearInterval(lockTimerRef.current);
      setLockToken(null);
      loadUpcoming();
      loadHistory();
      // Reset booking wizard
      setSelectedDoctor(null);
      setSelectedDate(null);
      setSelectedTime(null);
      setSymptoms("");
      setCurrentStep(1);
      setBooking(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.warning(err.message || "Selected slot is no longer available. Please choose another.");
        handleCancelLock();
      } else {
        toast.error((err as Error).message || "Failed to book appointment. Please try again.");
      }
      setBooking(false);
    }
  }

  /* ── Cancel lock / go back ── */
  function handleCancelLock() {
    releaseLock();
    if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    setLockToken(null);
    setSelectedTime(null);
    setSymptoms("");
    setRescheduleId(null);
    setCurrentStep(2);
  }

  /* ── Cancel appointment ── */
  function openCancelModal(id: number) {
    setCancelTargetId(id);
    setCancelReason("");
    setCancelModalOpen(true);
  }

  async function handleConfirmCancel() {
    if (!cancelTargetId) return;
    setCancelling(true);
    try {
      await apiCancelAppointment(cancelTargetId, cancelReason.trim() || undefined);
      toast.success("Appointment cancelled successfully.");
      setCancelModalOpen(false);
      setCancelTargetId(null);
      loadUpcoming();
      loadHistory();
    } catch (err) {
      toast.error((err as Error).message || "Failed to cancel appointment.");
    }
    setCancelling(false);
  }

  /* ── Reschedule ── */
  function handleReschedule(appointmentId: number) {
    setRescheduleId(appointmentId);
    setSelectedDoctor(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setLockToken(null);
    if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info("Select a doctor and time to reschedule your appointment.");
  }

  /* ── Calendar generation ── */
  function generateCalendarDays() {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();
    const startDow = firstDay.getDay();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cells: { day: number; date: Date; isPast: boolean; isToday: boolean; isWeekend: boolean; isEmpty: boolean; isSelected: boolean }[] = [];

    // Empty leading cells
    for (let i = 0; i < startDow; i++) {
      cells.push({ day: 0, date: new Date(), isPast: false, isToday: false, isWeekend: false, isEmpty: true, isSelected: false });
    }

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      const dow = date.getDay();
      cells.push({
        day: d,
        date,
        isPast: date <= today, // today + past = unbookable (24hr rule)
        isToday: isSameDay(date, today),
        isWeekend: dow === 0 || dow === 6,
        isEmpty: false,
        isSelected: selectedDate ? isSameDay(date, selectedDate) : false,
      });
    }
    return cells;
  }

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  const userName = profile?.full_name?.split(" ")[0] || "Patient";
  const userInitial = userName.charAt(0).toUpperCase();
  const calendarDays = generateCalendarDays();
  const HISTORY_PREVIEW = 3;

  const displayedHistory = historyExpanded ? history : history.slice(0, HISTORY_PREVIEW);
  const hasMoreHistory = !historyExpanded && (history.length > HISTORY_PREVIEW || historyTotalPages > 1);
  const hasActiveAppointment = upcoming.some((appt) => {
    const status = (appt.status || "").toLowerCase();
    return status === "scheduled" || status === "started";
  });
  const canUseBookingWizard = !hasActiveAppointment || rescheduleId !== null;

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
      <motion.div {...sectionAnim} className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
          {rescheduleId ? "Reschedule" : "Book"}{" "}
          <span className="text-sky-600 dark:text-sky-300">
            Appointment
          </span>
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-[15px] text-slate-500 dark:text-slate-300">
          {rescheduleId
            ? "Select a new doctor, date, and time for your rescheduled consultation"
            : "Select your preferred doctor, date, and time for your virtual consultation"}
        </p>
      </motion.div>

      {!canUseBookingWizard && (
        <motion.section
          {...sectionAnim}
          className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/20"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <h2 className="text-base font-semibold text-amber-900 dark:text-amber-200">
                You already booked an appointment
              </h2>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                Please complete your current appointment before booking a new one.
              </p>
            </div>
          </div>
        </motion.section>
      )}

      {/* Step Indicator */}
      {canUseBookingWizard && (
        <div className="flex items-center justify-center gap-0 flex-wrap">
          {[
            { num: 1, label: "Select Doctor" },
            { num: 2, label: "Date & Time" },
            { num: 3, label: "Confirm" },
          ].map((step, idx) => (
            <div key={step.num} className="flex items-center">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  currentStep === step.num && "bg-sky-50 text-sky-600 font-semibold dark:bg-sky-500/20 dark:text-sky-300",
                  currentStep > step.num && "text-emerald-600 dark:text-emerald-300",
                  currentStep < step.num && "text-slate-400 dark:text-slate-500",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                    currentStep === step.num && "bg-sky-500 text-white",
                    currentStep > step.num && "bg-emerald-500 text-white",
                    currentStep < step.num && "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300",
                  )}
                >
                  {currentStep > step.num ? <Check className="h-3.5 w-3.5" /> : step.num}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </div>
              {idx < 2 && (
                <div
                  className={cn(
                    "mx-1 h-0.5 w-8 rounded transition-colors",
                    currentStep > step.num ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700",
                  )}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══════════ STEP 1: DOCTOR SELECTION ═══════════ */}
      {canUseBookingWizard && currentStep === 1 && (
        <motion.section
          {...sectionAnim}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8"
        >
          <h2 className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4 text-xl font-bold text-slate-900 dark:border-slate-700 dark:text-slate-100">
            <UserRound className="h-5 w-5 text-sky-500" />
            Choose a Doctor
          </h2>

          {doctorsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-sky-500" />
              <p>Loading available doctors...</p>
            </div>
          ) : doctorsError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <p className="text-center text-sm">
                Unable to load doctors. Check backend/API and try again.
              </p>
              <Button size="sm" onClick={loadDoctors} className="rounded-lg bg-sky-500 hover:bg-sky-600">
                Retry
              </Button>
            </div>
          ) : doctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <UserRound className="mb-3 h-8 w-8" />
              <p>No doctors available at this time. Please try again later.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {doctors.map((doc) => {
                const initials = (doc.full_name || doc.name || "DR")
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase();
                const isSelected = selectedDoctor?.id === doc.id;

                return (
                  <div
                    key={doc.id}
                    onClick={() => handleSelectDoctor(doc)}
                    className={cn(
                      "cursor-pointer rounded-xl border-2 p-5 transition-all hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-100/30 dark:hover:border-sky-500 dark:hover:shadow-none",
                      isSelected
                        ? "border-sky-500 bg-sky-50/50 shadow-md shadow-sky-100/30 dark:bg-sky-500/10 dark:shadow-none"
                        : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800",
                    )}
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white dark:bg-sky-500">
                        {initials}
                      </div>
                      <div>
                        <h3 className="text-[15px] font-semibold text-slate-900">
                          {doc.full_name || doc.name || "Doctor"}
                        </h3>
                        <span className="text-sm font-medium text-sky-600">
                          {doc.specialization || "General"}
                        </span>
                      </div>
                    </div>
                    <div className="mb-4 space-y-1 text-[13px] text-slate-500">
                      {doc.experience_years && (
                        <p className="flex items-center gap-1.5">
                          <Stethoscope className="h-3.5 w-3.5 text-sky-500" />
                          {doc.experience_years} yrs experience
                        </p>
                      )}
                      {doc.hospital_name && (
                        <p className="flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-sky-500" />
                          {doc.hospital_name}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className={cn(
                        "w-full rounded-lg text-[13px] font-semibold",
                        isSelected
                          ? "bg-emerald-500 hover:bg-emerald-600"
                          : "bg-sky-500 hover:bg-sky-600",
                      )}
                    >
                      {isSelected ? (
                        <><Check className="mr-1.5 h-3.5 w-3.5" /> Selected</>
                      ) : (
                        <><CalendarCheck className="mr-1.5 h-3.5 w-3.5" /> Select</>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </motion.section>
      )}

      {/* ═══════════ STEP 2: DATE & TIME ═══════════ */}
      {canUseBookingWizard && currentStep === 2 && (
        <motion.section
          {...sectionAnim}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8"
        >
          <h2 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4 text-xl font-bold text-slate-900 dark:border-slate-700 dark:text-slate-100">
            <Calendar className="h-5 w-5 text-sky-500" />
            Select Date & Time
          </h2>

          <p className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-300">
            <Info className="h-4 w-4 text-sky-500" />
            Appointments must be booked at least 24 hours in advance.
          </p>

          {/* Selected doctor banner */}
          <div className="mb-6 flex items-center gap-3 rounded-lg border-l-4 border-sky-500 bg-sky-50/70 px-4 py-3 dark:bg-sky-500/10">
            <UserRound className="h-5 w-5 text-sky-500" />
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {selectedDoctor?.full_name || selectedDoctor?.name || "Doctor"}
            </span>
            <button
              onClick={handleChangeDoctor}
              className="ml-auto flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-sky-400 hover:text-sky-600 dark:border-slate-600 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300"
            >
              <ArrowRightLeft className="h-3 w-3" /> Change
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Calendar */}
            <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-700">
                <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-800 dark:text-slate-100">
                  <Calendar className="h-4 w-4 text-sky-500" />
                  {MONTH_NAMES[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCalendarMonth((p) => { const n = new Date(p); n.setMonth(n.getMonth() - 1); return n; })}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sky-500 transition-colors hover:bg-sky-50 dark:hover:bg-sky-500/15"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setCalendarMonth((p) => { const n = new Date(p); n.setMonth(n.getMonth() + 1); return n; })}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sky-500 transition-colors hover:bg-sky-50 dark:hover:bg-sky-500/15"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="mb-2 grid grid-cols-7 gap-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="py-1 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell, i) => {
                  if (cell.isEmpty) return <div key={`e-${i}`} className="aspect-square" />;
                  const disabled = cell.isPast;
                  return (
                    <button
                      key={`d-${cell.day}`}
                      disabled={disabled}
                      onClick={() => handleDateClick(cell.date)}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-lg text-sm font-medium transition-all",
                        disabled && "cursor-not-allowed text-slate-300 opacity-50",
                        !disabled && !cell.isSelected && "hover:bg-slate-100 dark:hover:bg-slate-700",
                        cell.isToday && !cell.isSelected && "border-2 border-sky-300 bg-sky-50 dark:bg-sky-500/10",
                        cell.isSelected && "bg-sky-500 text-white shadow-sm",
                        cell.isWeekend && !disabled && !cell.isSelected && "text-amber-500",
                      )}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slots */}
            <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-700 dark:bg-slate-800/60">
              <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-800 dark:text-slate-100">
                <Clock className="h-4 w-4 text-sky-500" />
                Available Slots
              </h3>

              {/* Legend */}
              <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded border-2 border-emerald-500 bg-emerald-500/20" />
                  Available
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded border-2 border-amber-500 bg-amber-500/20" />
                  Locked
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded bg-slate-300 opacity-50" />
                  Booked
                </span>
              </div>

              {!selectedDate ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <MousePointerClick className="mb-2 h-7 w-7 text-sky-400" />
                  <p className="text-sm">Select a date to view available slots</p>
                </div>
              ) : slotsLoading ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <Loader2 className="mb-2 h-7 w-7 animate-spin text-sky-500" />
                  <p className="text-sm">Loading available slots...</p>
                </div>
              ) : slots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <CalendarX className="mb-2 h-7 w-7" />
                  <p className="text-sm">No slots available for this date. Please choose another date.</p>
                </div>
              ) : (
                <div className="grid max-h-75 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                  {slots.map((slot) => {
                    const display = formatTime24to12(slot.time);
                    const isBooked = slot.status === "booked";
                    const isLocked = slot.status === "locked";
                    const isSlotSelected = selectedTime === slot.time && slot.status === "available";

                    return (
                      <button
                        key={slot.time}
                        disabled={isBooked || isLocked}
                        onClick={() => handleSlotClick(slot.time)}
                        className={cn(
                          "rounded-lg border-2 px-2 py-2 text-center text-sm font-medium transition-all",
                          isBooked && "cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400 opacity-60",
                          isLocked && "cursor-not-allowed border-amber-400 bg-amber-50 text-amber-500",
                          !isBooked && !isLocked && !isSlotSelected &&
                            "border-emerald-400 bg-slate-50 text-slate-700 hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-50",
                          isSlotSelected && "border-sky-500 bg-sky-500 text-white shadow-sm",
                        )}
                      >
                        {isLocked && <Lock className="mr-0.5 inline h-3 w-3" />}
                        {display}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.section>
      )}

      {/* ═══════════ STEP 3: CONFIRM BOOKING ═══════════ */}
      {canUseBookingWizard && currentStep === 3 && (
        <motion.section
          {...sectionAnim}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8"
        >
          <h2 className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4 text-xl font-bold text-slate-900 dark:border-slate-700 dark:text-slate-100">
            <CalendarCheck className="h-5 w-5 text-sky-500" />
            Confirm Booking
          </h2>

          <div className="mx-auto max-w-lg">
            {/* Lock Timer */}
            <div
              className={cn(
                "mb-6 rounded-xl border-2 p-5 text-center transition-colors",
                lockExpiring
                  ? "border-red-400 bg-red-50/50"
                  : "border-amber-400 bg-amber-50/50",
              )}
            >
              <p className="mb-1 flex items-center justify-center gap-1.5 text-sm text-slate-500">
                <Hourglass className={cn("h-4 w-4", lockExpiring ? "text-red-500" : "text-amber-500")} />
                Slot reserved for
              </p>
              <p
                className={cn(
                  "text-4xl font-bold tabular-nums",
                  lockExpiring ? "animate-pulse text-red-500" : "text-amber-500",
                )}
              >
                {lockDisplay}
              </p>
            </div>

            {/* Appointment Summary */}
            <div className="mb-6 rounded-xl border-2 border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/70">
              <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800 dark:text-slate-100">
                <ClipboardList className="h-4 w-4 text-sky-500" />
                Appointment Summary
              </h3>
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                <div className="flex items-center justify-between py-3">
                  <span className="flex items-center gap-2 text-sm text-slate-500">
                    <UserRound className="h-4 w-4 text-sky-500" /> Doctor
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {selectedDoctor?.full_name || selectedDoctor?.name || "Doctor"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="flex items-center gap-2 text-sm text-slate-500">
                    <Calendar className="h-4 w-4 text-sky-500" /> Date
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {selectedDate ? formatDateDisplay(selectedDate) : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="flex items-center gap-2 text-sm text-slate-500">
                    <Clock className="h-4 w-4 text-sky-500" /> Time
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {selectedTime ? formatTime24to12(selectedTime) : "--"}
                  </span>
                </div>
              </div>
            </div>

            {/* Symptoms */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                <Stethoscope className="mr-1.5 inline h-4 w-4 text-sky-500" />
                Symptoms / Reason for Visit
              </label>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Briefly describe your symptoms or reason for this appointment..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <p className="mt-1 text-right text-xs text-slate-400 dark:text-slate-500">
                {symptoms.length}/1000
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={handleConfirmBooking}
                disabled={booking || !lockToken}
                className="flex-1 rounded-xl bg-sky-500 py-5 text-[15px] font-semibold text-white shadow-md shadow-sky-500/20 hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {booking ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {rescheduleId ? "Rescheduling..." : "Booking..."}</>
                ) : (
                  <><CalendarCheck className="mr-2 h-4 w-4" /> {rescheduleId ? "Confirm Reschedule" : "Confirm Booking"}</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancelLock}
                className="rounded-xl border-2 border-red-200 px-5 py-5 text-[15px] font-semibold text-red-500 hover:bg-red-50"
              >
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
            </div>
          </div>
        </motion.section>
      )}

      {/* ═══════════ UPCOMING APPOINTMENTS ═══════════ */}
      <motion.section
        {...sectionAnim}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8"
      >
        <h2 className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4 text-xl font-bold text-slate-900 dark:border-slate-700 dark:text-slate-100">
          <CalendarCheck className="h-5 w-5 text-sky-500" />
          Your Upcoming Appointments
        </h2>

        {upcomingLoading ? (
          <div className="flex flex-col items-center py-10 text-slate-400">
            <Loader2 className="mb-2 h-7 w-7 animate-spin text-sky-500" />
            <p className="text-sm">Loading appointments...</p>
          </div>
        ) : upcomingError ? (
          <div className="flex flex-col items-center py-10 text-slate-500">
            <AlertTriangle className="mb-2 h-7 w-7 text-amber-500" />
            <p className="text-sm">Could not load upcoming appointments.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={loadUpcoming}
              className="mt-3 rounded-lg"
            >
              Retry
            </Button>
          </div>
        ) : upcoming.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-slate-400">
            <CalendarPlus className="mb-2 h-8 w-8" />
            <p className="text-sm">No upcoming appointments. Book one above!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((appt) => {
              const d = new Date(appt.appointment_date);
              const dayNum = d.getDate();
              const monthStr = MONTH_NAMES[d.getMonth()].substring(0, 3).toUpperCase();
              const timeStr = appt.appointment_time || "--:--";
              const doctorName = appt.doctor_name || "Doctor";
              const status = (appt.status || "scheduled").toLowerCase();

              return (
                <div
                  key={appt.id}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800"
                >
                  {/* Date box */}
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-sky-600 text-white shadow-sm dark:bg-sky-500">
                    <span className="text-lg font-bold leading-none">{dayNum}</span>
                    <span className="text-[10px] font-medium uppercase">{monthStr}</span>
                  </div>
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      <Clock className="h-3.5 w-3.5 text-sky-500" />
                      {formatTime24to12(timeStr)}
                    </p>
                    <p className="flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-300">
                      <UserRound className="h-3.5 w-3.5 text-emerald-500" />
                      Dr. {doctorName}
                    </p>
                  </div>
                  {/* Status badge */}
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold capitalize",
                      status === "scheduled" && "bg-sky-100 text-sky-600",
                      status === "started" && "bg-amber-100 text-amber-600",
                      status === "completed" && "bg-emerald-100 text-emerald-600",
                      status === "cancelled" && "bg-red-100 text-red-500",
                    )}
                  >
                    {status}
                  </span>
                  {/* Actions */}
                  {status === "scheduled" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReschedule(appt.id)}
                        className="flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-600 transition-colors hover:bg-sky-500 hover:text-white"
                      >
                        <RefreshCw className="h-3 w-3" /> Reschedule
                      </button>
                      <button
                        onClick={() => openCancelModal(appt.id)}
                        className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500 hover:text-white"
                      >
                        <X className="h-3 w-3" /> Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.section>

      {/* ═══════════ PAST APPOINTMENTS ═══════════ */}
      <motion.section
        {...sectionAnim}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8"
      >
        <h2 className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4 text-xl font-bold text-slate-900 dark:border-slate-700 dark:text-slate-100">
          <History className="h-5 w-5 text-sky-500" />
          Past Appointments
        </h2>

        {historyLoading ? (
          <div className="flex flex-col items-center py-10 text-slate-400">
            <Loader2 className="mb-2 h-7 w-7 animate-spin text-sky-500" />
            <p className="text-sm">Loading history...</p>
          </div>
        ) : historyError ? (
          <div className="flex flex-col items-center py-10 text-slate-500">
            <AlertTriangle className="mb-2 h-7 w-7 text-amber-500" />
            <p className="text-sm">Could not load appointment history.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={loadHistory}
              className="mt-3 rounded-lg"
            >
              Retry
            </Button>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-slate-400">
            <History className="mb-2 h-8 w-8" />
            <p className="text-sm">No past appointments.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {displayedHistory.map((appt) => {
                const d = new Date(appt.appointment_date);
                const dayNum = d.getDate();
                const monthStr = MONTH_NAMES[d.getMonth()].substring(0, 3).toUpperCase();
                const timeStr = appt.appointment_time || "--:--";
                const doctorName = appt.doctor_name || appt.patient_name || "Doctor";
                const status = (appt.status || "completed").toLowerCase();
                const roomId = appt.room_id;

                return (
                  <div
                    key={appt.id}
                    className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-sky-600 text-white shadow-sm dark:bg-sky-500">
                      <span className="text-lg font-bold leading-none">{dayNum}</span>
                      <span className="text-[10px] font-medium uppercase">{monthStr}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                        <Clock className="h-3.5 w-3.5 text-sky-500" />
                        {formatTime24to12(timeStr)}
                      </p>
                      <p className="flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-300">
                        <UserRound className="h-3.5 w-3.5 text-emerald-500" />
                        Dr. {doctorName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold capitalize",
                          status === "completed" && "bg-emerald-100 text-emerald-600",
                          status === "cancelled" && "bg-red-100 text-red-500",
                          status === "scheduled" && "bg-sky-100 text-sky-600",
                          status === "started" && "bg-amber-100 text-amber-600",
                        )}
                      >
                        {status}
                      </span>
                      {status === "completed" && roomId && (
                        <a
                          href={`${API_BASE}/api/prescription/download/${roomId}`}
                          download
                          className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500 hover:text-white"
                        >
                          <Download className="h-3 w-3" /> Prescription
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* View All / Pagination */}
            {hasMoreHistory && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => { setHistoryExpanded(true); setHistoryPage(1); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-5 py-2 text-sm font-semibold text-sky-600 transition-colors hover:bg-sky-500 hover:text-white"
                >
                  <ClipboardList className="h-4 w-4" /> View All Past Appointments
                </button>
              </div>
            )}

            {historyExpanded && historyTotalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-4">
                <button
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage((p) => p - 1)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-sky-400 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <span className="text-sm text-slate-500">
                  Page {historyPage} of {historyTotalPages}
                </span>
                <button
                  disabled={historyPage >= historyTotalPages}
                  onClick={() => setHistoryPage((p) => p + 1)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-sky-400 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </motion.section>

      {/* ═══════════ CANCEL APPOINTMENT MODAL ═══════════ */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Cancel Appointment
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this appointment? Please provide a reason below.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason for cancellation (optional)..."
            rows={3}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" className="rounded-lg">
                  Go Back
                </Button>
              }
            />
            <Button
              onClick={handleConfirmCancel}
              disabled={cancelling}
              className="rounded-lg bg-red-500 text-white hover:bg-red-600"
            >
              {cancelling ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cancelling...</>
              ) : (
                <><Trash2 className="mr-2 h-4 w-4" /> Cancel Appointment</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
