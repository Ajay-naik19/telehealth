"use client";

import type { RefObject } from "react";
import { User } from "lucide-react";

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  label: string;
  muted?: boolean;
  mirrored?: boolean;
  objectFit?: "cover" | "contain";
  videoOff?: boolean;
  className?: string;
};

export default function VideoTile({
  videoRef,
  label,
  muted = false,
  mirrored = false,
  objectFit = "cover",
  videoOff = false,
  className = "",
}: Props) {
  return (
    <div className={`relative h-full w-full overflow-hidden rounded-2xl border border-white/20 bg-black/80 ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full bg-black ${objectFit === "contain" ? "object-contain" : "object-cover"} ${mirrored ? "scale-x-[-1]" : ""}`}
      />

      {videoOff && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-slate-800/80 text-slate-100">
            <User className="h-5 w-5" />
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
        {label}
      </div>
    </div>
  );
}
