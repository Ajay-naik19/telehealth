"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Camera, CheckCircle2, Loader2, Mic, Moon, RefreshCw, ShieldCheck, Sun, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getPatientVideoRoom } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/backend";

function gradeNetwork(rttMs: number | null) {
  if (rttMs === null) return { label: "Unknown", tone: "text-slate-400" };
  if (rttMs < 120) return { label: "Excellent", tone: "text-emerald-600" };
  if (rttMs < 250) return { label: "Good", tone: "text-sky-600" };
  if (rttMs < 500) return { label: "Fair", tone: "text-amber-600" };
  return { label: "Poor", tone: "text-rose-600" };
}

export default function PatientSetupPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = params.roomId;

  const [checking, setChecking] = useState(true);
  const [roomValid, setRoomValid] = useState(false);
  const [cameraOk, setCameraOk] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [rtt, setRtt] = useState<number | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [mobileJoinCountdown, setMobileJoinCountdown] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const network = useMemo(() => gradeNetwork(rtt), [rtt]);

  const runChecks = async () => {
    setChecking(true);
    setErrorText(null);
    setRoomValid(false);

    try {
      await getPatientVideoRoom(roomId);
      setRoomValid(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to validate room.";
      setErrorText(message);
      setChecking(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;

      setCameraOk(stream.getVideoTracks().length > 0);
      setMicOk(stream.getAudioTracks().length > 0);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraOk(false);
      setMicOk(false);
      setErrorText("Camera and microphone permissions are required.");
    }

    const startedAt = performance.now();
    try {
      await fetch(`${API_BASE}/health`, { cache: "no-store", credentials: "include" });
      setRtt(Math.round(performance.now() - startedAt));
    } catch {
      setRtt(700);
    }

    setChecking(false);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const initialTheme: "light" | "dark" =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : "light";

    document.documentElement.classList.toggle("dark", initialTheme === "dark");
    localStorage.setItem("theme", initialTheme);
    setTheme(initialTheme);

    runChecks().catch(() => {});

    if (typeof window !== "undefined") {
      const checkMobile = () => {
        const mobileByViewport = window.matchMedia("(max-width: 1024px)").matches;
        const mobileByUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        );
        setIsMobileDevice(mobileByViewport || mobileByUserAgent);
      };

      checkMobile();
      window.addEventListener("resize", checkMobile);

      return () => {
        window.removeEventListener("resize", checkMobile);
        streamRef.current?.getTracks().forEach((track) => track.stop());
      };
    }

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [roomId]);

  const canContinue = roomValid && cameraOk && micOk;
  const mobileJoinBlocked = isMobileDevice && mobileJoinCountdown > 0;

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
  };

  const continueToRoom = () => {
    if (!canContinue) return;
    if (mobileJoinBlocked) return;
    localStorage.setItem(`videoSetup:patient:${roomId}`, "ok");
    toast.success("Setup complete. Joining secure consultation room...");
    router.push(`/patient/video/${roomId}`);
  };

  useEffect(() => {
    if (!isMobileDevice || !canContinue || checking) {
      setMobileJoinCountdown(0);
      return;
    }

    setMobileJoinCountdown(3);
    const intervalId = window.setInterval(() => {
      setMobileJoinCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isMobileDevice, canContinue, checking]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-6 sm:py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:bg-secondary dark:border-white/70 dark:text-white"
              aria-label="Toggle theme"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="rounded-xl bg-sky-100 p-3 text-sky-700">
              <ShieldCheck className="h-5 w-5 dark:text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Patient pre-call setup</h1>
              <p className="text-sm text-slate-500 dark:text-white">Validate your room, permissions, and connection quality before joining.</p>
            </div>
          </div>

          {isMobileDevice && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/25 dark:text-amber-200">
              For best consultation quality, please join using a desktop or laptop. You can still continue on mobile after a 3 second safety pause.
            </div>
          )}

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="h-57.5 w-full object-cover sm:h-82.5" />
          </div>

          {errorText && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {errorText}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={runChecks} disabled={checking}>
              {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Re-run checks
            </Button>
            <Button type="button" onClick={continueToRoom} disabled={!canContinue || checking || mobileJoinBlocked}>
              {mobileJoinBlocked ? `Join room in ${mobileJoinCountdown}s` : "Join room"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-white">Readiness checklist</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <span className="inline-flex items-center gap-2 text-slate-700 dark:text-white"><ShieldCheck className="h-4 w-4 dark:text-white" /> Room access</span>
              {roomValid ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-white" /> : <Loader2 className="h-4 w-4 animate-spin text-slate-400 dark:text-white" />}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <span className="inline-flex items-center gap-2 text-slate-700 dark:text-white"><Camera className="h-4 w-4 dark:text-white" /> Camera</span>
              {cameraOk ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-white" /> : <span className="text-slate-500 dark:text-white">Needs permission</span>}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <span className="inline-flex items-center gap-2 text-slate-700 dark:text-white"><Mic className="h-4 w-4 dark:text-white" /> Microphone</span>
              {micOk ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-white" /> : <span className="text-slate-500 dark:text-white">Needs permission</span>}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <span className="inline-flex items-center gap-2 text-slate-700 dark:text-white"><Wifi className="h-4 w-4 dark:text-white" /> Network</span>
              <span className={`font-semibold ${network.tone} dark:text-white`}>{network.label}{rtt !== null ? ` (${rtt}ms)` : ""}</span>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-white">
            Secure signaling is authenticated with your session token. If checks fail, refresh permissions and retry.
          </p>
        </aside>
      </div>
    </main>
  );
}
