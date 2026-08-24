"use client";

import { Clock3, Moon, Sun, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";

type Role = "doctor" | "user";

type Props = {
  role: Role;
  peerName: string;
  callStatus: string;
  peerConnected: boolean;
  theme: "light" | "dark";
  timerText: string;
  onToggleTheme: () => void;
};

function initials(name: string) {
  const cleaned = name.trim();
  if (!cleaned) return "U";
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "U";
}

export default function VideoCallNavbar({
  role,
  peerName,
  callStatus,
  peerConnected,
  theme,
  timerText,
  onToggleTheme,
}: Props) {
  const shellClass =
    theme === "dark"
      ? "fixed left-0 right-0 top-0 z-40 border-b border-slate-800/80 bg-slate-950/70"
      : "fixed left-0 right-0 top-0 z-40 border-b border-slate-200/90 bg-white/70";

  const centerLabel = role === "doctor"
    ? `Consultation with ${peerName}`
    : `Connected • Dr. ${peerName}`;

  return (
    <header className={`${shellClass} backdrop-blur-xl`}>
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-3 sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Logo size="sm" />
        </div>

        <div className="hidden max-w-[45vw] flex-col items-center md:flex">
          <p className={theme === "dark" ? "truncate text-sm font-medium text-white" : "truncate text-sm font-medium text-slate-900"}>
            {centerLabel}
          </p>
          <p className={theme === "dark" ? "truncate text-xs text-slate-300" : "truncate text-xs text-slate-600"}>
            {callStatus}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className={theme === "dark" ? "hidden items-center gap-1 rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-xs text-slate-200 sm:inline-flex" : "hidden items-center gap-1 rounded-full border border-slate-300 bg-white/80 px-2.5 py-1 text-xs text-slate-700 sm:inline-flex"}>
            {peerConnected ? <Wifi className="h-3.5 w-3.5 text-emerald-500" /> : <WifiOff className="h-3.5 w-3.5 text-amber-500" />}
            {peerConnected ? "Good" : "Poor"}
          </div>

          {role === "doctor" && (
            <div className={theme === "dark" ? "hidden items-center gap-1 rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-xs text-slate-200 sm:inline-flex" : "hidden items-center gap-1 rounded-full border border-slate-300 bg-white/80 px-2.5 py-1 text-xs text-slate-700 sm:inline-flex"}>
              <Clock3 className="h-3.5 w-3.5" />
              {timerText}
            </div>
          )}

          <Button
            type="button"
            size="icon"
            variant="outline"
            className={theme === "dark" ? "h-9 w-9 border-slate-700 bg-slate-900 text-slate-100" : "h-9 w-9 border-slate-300 bg-white text-slate-800"}
            onClick={onToggleTheme}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <div className={theme === "dark" ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-xs font-semibold text-white" : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-xs font-semibold text-slate-700"}>
            {initials(role === "doctor" ? "Doctor" : "Patient")}
          </div>
        </div>
      </div>
    </header>
  );
}
