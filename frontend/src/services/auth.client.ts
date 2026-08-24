import { apiRequest } from "@/lib/api";
import { getPostAuthRoute, normalizeAppRole, type AppRole } from "@/config/routes";

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

function toAuthUser(data: SessionEnvelopeData | null | undefined): AuthUser | null {
  if (!data) return null;
  if (data.user) {
    const role = normalizeAppRole(data.user.role);
    return role ? { ...data.user, role, profileComplete: Boolean(data.user.profileComplete) } : null;
  }

  const role = normalizeAppRole(data.role);
  if (!role || typeof data.userId !== "number") return null;
  return {
    userId: data.userId,
    role,
    backendRole: data.backendRole || (role === "doctor" ? "doctor" : "user"),
    profileComplete: Boolean(data.profileComplete),
  };
}

export function login(role: AppRole, phone: string, password: string): Promise<AuthUser> {
  return apiRequest<AuthUser>(`/api/auth/${role}/login`, { method: "POST", body: { phone, password } });
}

export function signup(role: AppRole, phone: string, password: string, confirmpassword: string): Promise<AuthUser> {
  return apiRequest<AuthUser>(`/api/auth/${role}/signup`, {
    method: "POST",
    body: { phone, password, confirmpassword },
  });
}

export async function logout(): Promise<void> {
  await apiRequest<null>("/api/auth/logout", { method: "GET" });
}

export async function getSession(): Promise<SessionState> {
  const data = await apiRequest<SessionEnvelopeData>("/api/auth/session", { method: "GET", cache: "no-store" });
  return data?.authenticated ? { authenticated: true, user: toAuthUser(data) } : { authenticated: false, user: null };
}

export async function getSocketTokenFromSession(): Promise<string | null> {
  const data = await apiRequest<Record<string, unknown>>("/api/auth/session", { method: "GET", cache: "no-store" });
  const token = typeof data?.accessToken === "string" ? data.accessToken : null;
  return token && token.length > 20 ? token : null;
}

export function resolvePostLoginRoute(user: Pick<AuthUser, "role" | "profileComplete">): string {
  return getPostAuthRoute(user.role, Boolean(user.profileComplete));
}
