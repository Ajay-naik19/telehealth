"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

const PATTERN_ROUTES = new Set([
  "/",
  "/services",
  "/contact",
  "/auth",
  "/auth/patient",
  "/auth/doctor",
  "/admin/auth",
]);

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export default function ScopedMedicalPattern() {
  const pathname = usePathname();

  const showPattern = useMemo(() => {
    const normalized = normalizePath(pathname || "/");
    return PATTERN_ROUTES.has(normalized);
  }, [pathname]);

  if (!showPattern) {
    return null;
  }

  return <div className="site-background" aria-hidden="true" />;
}