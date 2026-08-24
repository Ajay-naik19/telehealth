"use client";

import { useIsFetching } from "@tanstack/react-query";

export default function GlobalLoadingBar() {
  const isFetching = useIsFetching();

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed left-0 right-0 top-0 z-[70] h-1 transition-opacity duration-200 ${
        isFetching > 0 ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="h-full w-full animate-pulse bg-sky-500" />
    </div>
  );
}
