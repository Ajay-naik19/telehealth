import Link from "next/link";
import { AlertTriangle, Home, SearchX } from "lucide-react";

const codeGuide = [
  { code: "400", label: "Bad Request", owner: "User/Input", hint: "Check required fields and request format." },
  { code: "401", label: "Unauthorized", owner: "Auth", hint: "Login again and retry." },
  { code: "403", label: "Forbidden", owner: "Permissions", hint: "You do not have access to this resource." },
  { code: "404", label: "Not Found", owner: "Route/Resource", hint: "URL or resource may not exist." },
  { code: "409", label: "Conflict", owner: "Business Rule", hint: "Data already exists or state changed." },
  { code: "422", label: "Validation Failed", owner: "User/Input", hint: "Fix field values and submit again." },
  { code: "500", label: "Internal Error", owner: "App", hint: "Unexpected app issue. Please retry." },
  { code: "502", label: "Bad Gateway", owner: "Backend", hint: "Upstream API/service is failing." },
  { code: "503", label: "Service Unavailable", owner: "Server", hint: "Server is temporarily unavailable." },
  { code: "504", label: "Gateway Timeout", owner: "Backend/DB", hint: "Dependency took too long to respond." },
];

export default function NotFound() {
  return (
    <main className="content-overlay min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300">
            <SearchX className="h-4 w-4" />
            Error 404
          </div>

          <h1 className="font-heading text-3xl font-bold text-slate-900 dark:text-slate-100">
            Page Not Found
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
            The page you requested does not exist, was moved, or the URL is incorrect. Use the error code guide below to understand related issues quickly.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              <Home className="h-4 w-4" />
              Go Home
            </Link>
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Go To Auth
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mb-5 flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            <h2 className="font-heading text-xl font-bold">Error Code Guide</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {codeGuide.map((item) => (
              <article
                key={item.code}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-heading text-lg font-bold text-slate-900 dark:text-slate-100">{item.code}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {item.owner}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.label}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.hint}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
