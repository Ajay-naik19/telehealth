import { apiRequest } from "@/lib/api";
import {
  getPostAuthRoute,
  normalizeAppRole,
  type AppRole,
} from "@/config/routes";

export interface AuthUser {
  userId: number;
  role: AppRole;
  backendRole: "user" | "doctor" | "admin";
  profileComplete: boolean;
}

type SessionEnvelopeData = {
  authenticated?: boolean;
  user?: AuthUser;
  userId?: number;
  role?: string;
  backendRole?: "user" | "doctor" | "admin";
  profileComplete?: boolean;
};

export interface SessionState {
  authenticated: boolean;
  user: AuthUser | null;
}

function toAuthUser(
  data: SessionEnvelopeData | null | undefined,
): AuthUser | null {
  if (!data) return null;

  if (data.user) {
    const normalizedRole = normalizeAppRole(data.user.role);
    if (!normalizedRole) return null;

    return {
      userId: data.user.userId,
      role: normalizedRole,
      backendRole: data.user.backendRole,
      profileComplete: Boolean(data.user.profileComplete),
    };
  }

  const normalizedRole = normalizeAppRole(data.role);
  if (!normalizedRole || typeof data.userId !== "number") return null;

  return {
    userId: data.userId,
    role: normalizedRole,
    backendRole:
      data.backendRole || (normalizedRole === "doctor" ? "doctor" : "user"),
    profileComplete: Boolean(data.profileComplete),
  };
}

export async function login(
  role: AppRole,
  phone: string,
  password: string,
): Promise<AuthUser> {
  return apiRequest<AuthUser>(`/api/auth/${role}/login`, {
    method: "POST",
    body: { phone, password },
  });
}

export async function signup(
  role: AppRole,
  phone: string,
  password: string,
  confirmpassword: string,
): Promise<AuthUser> {
  return apiRequest<AuthUser>(`/api/auth/${role}/signup`, {
    method: "POST",
    body: { phone, password, confirmpassword },
  });
}

export async function logout(): Promise<void> {
  await apiRequest<null>("/api/auth/logout", { method: "GET" });
}

export async function getSession(): Promise<SessionState> {
  const data = await apiRequest<SessionEnvelopeData>("/api/auth/session", {
    method: "GET",
    cache: "no-store",
  });

  if (!data?.authenticated) {
    return { authenticated: false, user: null };
  }

  return {
    authenticated: true,
    user: toAuthUser(data),
  };
}

export async function getSocketTokenFromSession(): Promise<string | null> {
  // Auth is cookie-first; token passthrough is optional and only used if backend returns one.
  const data = await apiRequest<Record<string, unknown>>("/api/auth/session", {
    method: "GET",
    cache: "no-store",
  });

  const token = typeof data?.accessToken === "string" ? data.accessToken : null;
  return token && token.length > 20 ? token : null;
}

export function resolvePostLoginRoute(
  user: Pick<AuthUser, "role" | "profileComplete">,
): string {
  return getPostAuthRoute(user.role, Boolean(user.profileComplete));
}
