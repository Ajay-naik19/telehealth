"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  Calendar,
  Plus,
  Users,
  Video,
  Save,
  Trash2,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addDoctorScheduleOverride,
  getDoctorProfile,
  getDoctorSchedule,
  removeDoctorScheduleOverride,
  updateDoctorSchedule,
  type DoctorProfile,
  type DoctorScheduleData,
  type DoctorScheduleOverride,
  type DoctorScheduleUpdateItem,
} from "@/lib/api";
import { toast } from "sonner";
import Footer from "@/components/Footer";

const doctorNav: NavItem[] = [
  { href: "/doctor/home", label: "Home", icon: Activity },
  { href: "/doctor/video/dashboard", label: "Video Consult", icon: Video },
  { href: "/doctor/schedule", label: "Schedule", icon: Calendar },
  { href: "/doctor/profile", label: "Profile", icon: Users },
];

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const sectionAnim = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: "easeOut" as const },
};

interface WeeklyDayFormState {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

interface OverrideFormState {
  date: string;
  reason: string;
}

const defaultWeeklyState: WeeklyDayFormState[] = days.map(() => ({
  enabled: false,
  startTime: "09:00",
  endTime: "17:00",
}));

const defaultOverrideState: OverrideFormState = {
  date: "",
  reason: "",
};

function normalizeTime(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 5);
}

function hydrateWeeklyState(schedule: DoctorScheduleData["weeklySchedule"]) {
  const nextState = [...defaultWeeklyState];

  for (const entry of schedule) {
    const day = entry.day_of_week;
    if (day < 0 || day > 6) continue;

    const start = normalizeTime(entry.start_time);
    const end = normalizeTime(entry.end_time);

    if (!nextState[day].enabled) {
      nextState[day] = { enabled: true, startTime: start, endTime: end };
      continue;
    }

    if (start && start < nextState[day].startTime) {
      nextState[day].startTime = start;
    }
    if (end && end > nextState[day].endTime) {
      nextState[day].endTime = end;
    }
  }

  return nextState;
}

function formatOverrideDate(date: string) {
  const normalizedDate = date.includes("T") ? date.slice(0, 10) : date;
  const parsed = new Date(`${normalizedDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toInputDateValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DocSchedule() {
  const router = useRouter();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [weeklyState, setWeeklyState] = useState<WeeklyDayFormState[]>(defaultWeeklyState);
  const [overrides, setOverrides] = useState<DoctorScheduleOverride[]>([]);
  const [overrideForm, setOverrideForm] = useState<OverrideFormState>(defaultOverrideState);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [deletingOverrideId, setDeletingOverrideId] = useState<number | null>(null);

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
    Promise.all([getDoctorProfile(), getDoctorSchedule()])
      .then(([profileRes, scheduleRes]) => {
        if (cancelled) return;
        setProfile(profileRes.profile);
        setWeeklyState(hydrateWeeklyState(scheduleRes.weeklySchedule));
        setOverrides(scheduleRes.overrides);
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

  function updateDay(dayIndex: number, updates: Partial<WeeklyDayFormState>) {
    setWeeklyState((prev) => {
      const next = [...prev];
      next[dayIndex] = { ...next[dayIndex], ...updates };
      return next;
    });
  }

  async function handleSaveSchedule() {
    const payload: DoctorScheduleUpdateItem[] = weeklyState
      .map((day, dayOfWeek) => ({ day, dayOfWeek }))
      .filter(({ day }) => day.enabled)
      .map(({ day, dayOfWeek }) => ({
        dayOfWeek,
        startTime: day.startTime,
        endTime: day.endTime,
      }));

    const invalidDay = payload.find((item) => item.startTime >= item.endTime);
    if (invalidDay) {
      toast.error(`Invalid time range for ${days[invalidDay.dayOfWeek]}.`);
      return;
    }

    try {
      setSavingSchedule(true);
      const res = await updateDoctorSchedule(payload);
      setWeeklyState(hydrateWeeklyState(res));
      toast.success("Weekly schedule saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save schedule.";
      toast.error(message);
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleAddOverride() {
    if (!overrideForm.date) {
      toast.error("Please select a date.");
      return;
    }

    if (!overrideForm.reason.trim()) {
      toast.error("Please provide a reason.");
      return;
    }

    try {
      setSavingOverride(true);
      const payload = {
        date: overrideForm.date,
        reason: overrideForm.reason.trim(),
      };

      console.log("Adding override with payload:", payload);
      const addResult = await addDoctorScheduleOverride(payload);
      console.log("Override added successfully:", addResult);

      try {
        console.log("Refreshing schedule...");
        const refreshed = await getDoctorSchedule();
        console.log("Refreshed schedule data:", refreshed);
        setOverrides(refreshed.overrides);
      } catch (refreshError) {
        console.warn("Refresh after add failed, using optimistic override entry:", refreshError);
        const optimisticId =
          (addResult as { data?: { id?: number } })?.data?.id ?? Date.now();
        setOverrides((prev) => [
          ...prev,
          {
            id: optimisticId,
            override_date: payload.date,
            override_type: "unavailable",
            start_time: null,
            end_time: null,
            reason: payload.reason,
          },
        ]);
      }

      setOverrideForm(defaultOverrideState);
      toast.success("Schedule override added.");
    } catch (error) {
      console.error("Error adding override:", error);
      const message = error instanceof Error ? error.message : "Failed to add override.";
      toast.error(message);
    } finally {
      setSavingOverride(false);
    }
  }

  async function handleDeleteOverride(id: number) {
    try {
      setDeletingOverrideId(id);
      await removeDoctorScheduleOverride(id);
      setOverrides((prev) => prev.filter((item) => item.id !== id));
      toast.success("Override removed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove override.";
      toast.error(message);
    } finally {
      setDeletingOverrideId(null);
    }
  }

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
  const minOverrideDate = toInputDateValue(new Date());
  const reasonTrimmed = overrideForm.reason.trim();
  const showReasonError = savingOverride && !reasonTrimmed;

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
            Schedule Management
          </h1>
          <p className="text-slate-600 dark:text-white">
            Set your weekly availability and manage schedule overrides
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Weekly Schedule */}
          <motion.div
            {...sectionAnim}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-xl border border-slate-200/80 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-6 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-sky-600 dark:text-white" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Weekly Schedule
              </h2>
            </div>

            <div className="space-y-3">
              {days.map((day, idx) => {
                const state = weeklyState[idx];
                return (
                <div
                  key={idx}
                  className="flex flex-col gap-3 rounded-lg border border-slate-200/50 p-4 dark:border-slate-700/50 sm:flex-row sm:items-center"
                >
                  <label className="flex h-5 w-5 shrink-0 items-center">
                    <input
                      type="checkbox"
                      checked={state.enabled}
                      onChange={(e) => updateDay(idx, { enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-2 focus:ring-sky-500"
                    />
                  </label>
                  <span className="min-w-20 font-medium text-slate-900 dark:text-white">
                    {day}
                  </span>
                  <div className="grid w-full grid-cols-2 gap-2 sm:flex-1">
                    <Input
                      type="time"
                      value={state.startTime}
                      disabled={!state.enabled}
                      onChange={(e) => updateDay(idx, { startTime: e.target.value })}
                      className="text-sm"
                    />
                    <Input
                      type="time"
                      value={state.endTime}
                      disabled={!state.enabled}
                      onChange={(e) => updateDay(idx, { endTime: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                </div>
                );
              })}
            </div>

            <Button
              onClick={handleSaveSchedule}
              disabled={savingSchedule}
              className="mt-6 w-full bg-sky-600 text-white hover:bg-sky-700"
            >
              <Save className="mr-2 h-4 w-4" />
              {savingSchedule ? "Saving..." : "Save Schedule"}
            </Button>
          </motion.div>

          {/* Schedule Overrides */}
          <motion.div
            {...sectionAnim}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="rounded-xl border border-slate-200/80 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-6 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-sky-600 dark:text-white" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Schedule Overrides
              </h2>
            </div>

            <div className="overflow-x-auto">
              <div className="space-y-4 rounded-lg border border-slate-200/50 bg-slate-50 p-3 sm:p-4 dark:border-slate-700/50 dark:bg-slate-800/50">
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-slate-900 dark:text-white">
                    Date
                  </label>
                  <Input
                    type="date"
                    value={overrideForm.date}
                    onChange={(e) => setOverrideForm((prev) => ({ ...prev, date: e.target.value }))}
                    min={minOverrideDate}
                    className="mt-1 w-full text-sm"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-sm font-medium text-slate-900 dark:text-white">
                    Reason *
                  </label>
                  <Input
                    type="text"
                    value={overrideForm.reason}
                    onChange={(e) => setOverrideForm((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder="Vacation, emergency, conference..."
                    className={`mt-1 w-full text-sm ${showReasonError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    required
                    aria-invalid={showReasonError}
                  />
                  {showReasonError ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-white">Reason is required.</p>
                  ) : null}
                </div>

                <Button
                  onClick={handleAddOverride}
                  disabled={savingOverride || !reasonTrimmed}
                  className="w-full bg-sky-600 text-white hover:bg-sky-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {savingOverride ? "Adding..." : "Add Override"}
                </Button>
              </div>
            </div>

            {overrides.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-500 dark:text-white">
                  No overrides set
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {overrides.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200/60 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-900/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {formatOverrideDate(item.override_date)}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-white">
                          {item.override_type === "unavailable"
                            ? "Unavailable all day"
                            : `${normalizeTime(item.start_time)} - ${normalizeTime(item.end_time)}`}
                        </p>
                        {item.reason ? (
                          <p className="mt-1 text-xs text-slate-500 dark:text-white">
                            {item.reason}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteOverride(item.id)}
                        disabled={deletingOverrideId === item.id}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        {deletingOverrideId === item.id ? "Removing..." : "Remove"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}

