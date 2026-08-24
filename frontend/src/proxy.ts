import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getPostAuthRoute,
  normalizeAppRole,
  ROUTES,
  type AppRole,
} from "./config/routes";

const isProduction = process.env.NODE_ENV === "production";
const configuredBackend =
  process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_SERVER_API_URL;

if (isProduction && !configuredBackend) {
  throw new Error(
    "Missing backend API URL in production. Set NEXT_PUBLIC_API_URL or NEXT_SERVER_API_URL.",
  );
}

if (
  isProduction &&
  configuredBackend &&
  configuredBackend.startsWith("http://")
) {
  throw new Error("In production, backend API URL must use HTTPS.");
}

const BACKEND_URL = (configuredBackend || "http://localhost:10000").replace(
  /\/$/,
  "",
);
const SESSION_FETCH_TIMEOUT_MS = 70000;

const publicOnlyPaths = ["/", "/services", "/contact", "/auth", "/signup"];
const patientProtectedPaths = [
  "/patient/home",
  "/appointments",
  "/patient/video",
  "/pharmacy",
  "/records",
  "/patient/profile",
  "/patient/complete-profile",
  "/patient/profile/create",
];
const doctorProtectedPaths = [
  "/doctor/home",
  "/doctor/video",
  "/doctor/schedule",
  "/doctor/profile",
  "/doctor/past-appointments",
  "/doctor/complete-profile",
  "/doctor/profile/create",
];
const adminPublicPaths = ["/admin/auth"];
const adminProtectedPaths = ["/admin"];

type SessionPayload = {
  authenticated: boolean;
  role?: AppRole;
  backendRole?: "user" | "doctor" | "admin";
  profileComplete?: boolean;
};

type SessionEnvelope = {
  success: boolean;
  data: SessionPayload | null;
  message: string;
  authenticated?: boolean;
  role?: AppRole;
  backendRole?: "user" | "doctor" | "admin";
  profileComplete?: boolean;
};

type SessionDataPayload = {
  authenticated?: boolean;
  user?: {
    userId: number;
    role: AppRole;
    backendRole: "user" | "doctor" | "admin";
    profileComplete: boolean;
  };
  userId?: number;
  role?: string;
  backendRole?: "user" | "doctor" | "admin";
  profileComplete?: boolean;
};

function matchesPath(pathname: string, routes: string[]) {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

async function getSession(
  request: NextRequest,
): Promise<SessionPayload | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    SESSION_FETCH_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/session`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        cookie: request.headers.get("cookie") || "",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as SessionEnvelope;

    if (payload?.success === true) {
      const sessionData = payload.data as SessionDataPayload | null;

      if (sessionData && typeof sessionData === "object") {
        if (!sessionData.authenticated) {
          return { authenticated: false };
        }

        if (sessionData.user) {
          return {
            authenticated: true,
            role: sessionData.user.role,
            backendRole: sessionData.user.backendRole,
            profileComplete: sessionData.user.profileComplete,
          };
        }

        const normalizedRole = normalizeAppRole(sessionData.role);
        if (sessionData.authenticated && normalizedRole) {
          return {
            authenticated: true,
            role: normalizedRole,
            backendRole: sessionData.backendRole,
            profileComplete: Boolean(sessionData.profileComplete),
          };
        }
      }

      return {
        authenticated: Boolean(payload.authenticated),
        role: normalizeAppRole(payload.role) || undefined,
        backendRole: payload.backendRole,
        profileComplete: payload.profileComplete,
      };
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function resolveRoleLanding(
  role: AppRole | undefined,
  profileComplete: boolean | undefined,
) {
  if (!role) return "/";
  return getPostAuthRoute(role, Boolean(profileComplete));
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accept = request.headers.get("accept") || "";
  const contentType = request.headers.get("content-type") || "";
  const isJsonRequest =
    accept.includes("application/json") ||
    contentType.includes("application/json") ||
    request.headers.get("x-requested-with") === "XMLHttpRequest";

  // Allow API-like calls to pass through to backend rewrites.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }

  if (isJsonRequest) {
    return NextResponse.next();
  }

  const isPublicOnly =
    matchesPath(pathname, publicOnlyPaths) || pathname.startsWith("/auth/");
  const isAdminPublic = matchesPath(pathname, adminPublicPaths);
  const isPatientProtected = matchesPath(pathname, patientProtectedPaths);
  const isDoctorProtected = matchesPath(pathname, doctorProtectedPaths);
  const isAdminProtected = matchesPath(pathname, adminProtectedPaths);

  if (
    !isPublicOnly &&
    !isAdminPublic &&
    !isPatientProtected &&
    !isDoctorProtected &&
    !isAdminProtected
  ) {
    return NextResponse.next();
  }

  const session = await getSession(request);
  const hasAuthCookie =
    request.cookies.has("accessToken") || request.cookies.has("refreshToken");

  if (isPublicOnly) {
    if (session?.authenticated) {
      return redirectTo(
        request,
        resolveRoleLanding(session.role, session.profileComplete),
      );
    }
    return NextResponse.next();
  }

  if (isAdminPublic) {
    if (session?.authenticated && session.backendRole === "admin") {
      return redirectTo(request, "/admin");
    }
    return NextResponse.next();
  }

  if (isPatientProtected) {
    if (!session && hasAuthCookie) {
      return NextResponse.next();
    }
    if (!session?.authenticated) {
      return redirectTo(request, ROUTES.patient.auth);
    }
    if (session.role !== "patient") {
      return redirectTo(
        request,
        resolveRoleLanding(session.role, session.profileComplete),
      );
    }
    if (
      !session.profileComplete &&
      pathname !== ROUTES.patient.profile &&
      pathname !== "/patient/profile/create"
    ) {
      return redirectTo(request, ROUTES.patient.profile);
    }
    if (
      session.profileComplete &&
      (pathname === ROUTES.patient.profile ||
        pathname === "/patient/profile/create")
    ) {
      return redirectTo(request, ROUTES.patient.home);
    }
    return NextResponse.next();
  }

  if (isDoctorProtected) {
    if (!session && hasAuthCookie) {
      return NextResponse.next();
    }
    if (!session?.authenticated) {
      return redirectTo(request, ROUTES.doctor.auth);
    }
    if (session.role !== "doctor") {
      return redirectTo(
        request,
        resolveRoleLanding(session.role, session.profileComplete),
      );
    }
    if (
      !session.profileComplete &&
      pathname !== ROUTES.doctor.profile &&
      pathname !== "/doctor/profile/create"
    ) {
      return redirectTo(request, ROUTES.doctor.profile);
    }
    if (
      session.profileComplete &&
      (pathname === ROUTES.doctor.profile ||
        pathname === "/doctor/profile/create")
    ) {
      return redirectTo(request, ROUTES.doctor.home);
    }
    return NextResponse.next();
  }

  if (isAdminProtected) {
    if (!session && hasAuthCookie) {
      return NextResponse.next();
    }
    if (!session?.authenticated) {
      return redirectTo(request, "/admin/auth");
    }
    if (session.backendRole !== "admin") {
      return redirectTo(request, "/");
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/services",
    "/contact",
    "/auth/:path*",
    "/signup",
    "/patient/home",
    "/appointments/:path*",
    "/patient/video/:path*",
    "/pharmacy/:path*",
    "/records/:path*",
    "/patient/profile/:path*",
    "/patient/complete-profile/:path*",
    "/patient/profile/create/:path*",
    "/doctor/home/:path*",
    "/doctor/video/:path*",
    "/doctor/schedule/:path*",
    "/doctor/profile/:path*",
    "/doctor/complete-profile/:path*",
    "/doctor/past-appointments/:path*",
    "/doctor/profile/create/:path*",
    "/admin/auth/:path*",
    "/admin/:path*",
  ],
};
