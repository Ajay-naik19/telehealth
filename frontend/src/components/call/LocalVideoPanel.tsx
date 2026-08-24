"use client";

import type { RefObject } from "react";
import { UserRound } from "lucide-react";

type LocalVideoPanelProps = {
  label: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  showVideo: boolean;
};

function initialsFromLabel(value: string) {
  const parts = value.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "Y";
}

export default function LocalVideoPanel({ label, videoRef, showVideo }: LocalVideoPanelProps) {
  return (
    <div className="absolute bottom-20 right-3 z-20 w-30 cursor-grab overflow-hidden rounded-2xl ring-2 ring-white/20 shadow-2xl active:cursor-grabbing md:bottom-24 md:right-5 md:w-45">
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-20 w-full bg-zinc-900 object-cover md:h-30"
        />
      ) : (
        <div className="flex h-20 w-full flex-col items-center justify-center bg-linear-to-br from-zinc-700 to-zinc-900 md:h-30">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800/90 text-white md:h-10 md:w-10">
            <UserRound className="h-4 w-4 md:h-5 md:w-5" />
          </div>
        </div>
      )}

      <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
        You
      </span>
      <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
        {initialsFromLabel(label)}
      </span>
    </div>
  );
}
