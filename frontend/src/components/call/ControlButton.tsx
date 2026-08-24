"use client";

import type { ReactNode } from "react";

type ControlButtonProps = {
  icon: ReactNode;
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  muted?: boolean;
  danger?: boolean;
  iconOnlyOnMobile?: boolean;
};

export default function ControlButton({
  icon,
  label,
  title,
  onClick,
  active = false,
  muted = false,
  danger = false,
  iconOnlyOnMobile = false,
}: ControlButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95";
  const tone = danger
    ? "border-red-500/80 bg-red-600 text-white hover:bg-red-700"
    : muted
      ? "border-red-400/70 bg-red-500/80 text-white"
      : active
        ? "border-white/30 bg-white/20 text-white"
        : "border-white/20 bg-black/30 text-white hover:bg-black/45";

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`${base} ${tone}`}
      aria-label={label}
    >
      <span className="h-4 w-4">{icon}</span>
      <span className={iconOnlyOnMobile ? "hidden sm:inline" : "inline"}>{label}</span>
    </button>
  );
}
