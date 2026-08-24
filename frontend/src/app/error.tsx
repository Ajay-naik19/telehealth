"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Database, RefreshCcw, ServerCrash, ShieldAlert, TriangleAlert, UserX } from "lucide-react";

type ErrorGroup = {
  title: string;
  code: string;
  owner: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
};

function classifyError(error: Error): ErrorGroup {
  const msg = (error?.message || "").toLowerCase();

  if (msg.includes("unauthorized") || msg.includes("forbidden") || msg.includes("token")) {
    return {
      title: "Authentication / Permission Error",
      code: "401/403",
      owner: "User/Auth",
      hint: "Sign in again or verify account permissions.",
      icon: UserX,
    };
  }

  if (msg.includes("validation") || msg.includes("invalid") || msg.includes("required")) {
    return {
      title: "Validation Error",
      code: "400/422",
      owner: "User/Input",
      hint: "Review inputs and submit valid values.",
      icon: ShieldAlert,
    };
  }

  if (msg.includes("db") || msg.includes("database") || msg.includes("sql") || msg.includes("postgres")) {
    return {
      title: "Database Error",
      code: "500/503",
      owner: "Database",
      hint: "Database query or schema issue detected. Check backend logs.",
      icon: Database,
    };
  }

  if (msg.includes("timeout") || msg.includes("gateway") || msg.includes("upstream") || msg.includes("fetch failed")) {
    return {
      title: "Backend / Network Error",
      code: "502/504",
      owner: "Backend/Network",
      hint: "Upstream service is slow or unavailable. Retry shortly.",
      icon: ServerCrash,
    };
  }

  return {
    title: "Unexpected Application Error",
    code: "500",
    owner: "Application",
    hint: "This is likely an internal app issue. Retry, then contact support if persistent.",
    icon: TriangleAlert,
  };
}

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const details = useMemo(() => classifyError(error), [error]);
  const Icon = details.icon;

  return (
    <main className="content-overlay min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:border-rose-700/60 dark:bg-rose-900/20 dark:text-rose-300">
            <Icon className="h-4 w-4" />
            Error {details.code}
          </div>

          <h1 className="font-heading text-3xl font-bold text-slate-900 dark:text-slate-100">
            {details.title}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">{details.hint}</p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/70">
            <p className="font-semibold text-slate-800 dark:text-slate-200">Likely Owner: {details.owner}</p>
            {error?.message ? (
              <p className="mt-1 text-slate-600 dark:text-slate-400">Message: {error.message}</p>
            ) : null}
            {error?.digest ? (
              <p className="mt-1 text-slate-600 dark:text-slate-400">Digest: {error.digest}</p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              <RefreshCcw className="h-4 w-4" />
              Try Again
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
