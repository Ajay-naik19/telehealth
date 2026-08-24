"use client";

type CallTimerProps = {
  seconds: number;
};

function toClock(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function CallTimer({ seconds }: CallTimerProps) {
  return (
    <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs font-medium text-white backdrop-blur">
      {toClock(seconds)}
    </div>
  );
}
