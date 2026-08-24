export type AppRole = "doctor" | "patient";

export const ROUTES = {
  doctor: {
    auth: "/auth/doctor",
    home: "/doctor/home",
    profile: "/doctor/complete-profile",
  },
  patient: {
    auth: "/auth/patient",
    home: "/patient/home",
    profile: "/patient/complete-profile",
  },
} as const;

export function getPostAuthRoute(role: AppRole, profileComplete: boolean): string {
  return profileComplete ? ROUTES[role].home : ROUTES[role].profile;
}

export function normalizeAppRole(role?: string | null): AppRole | null {
  if (role === "doctor" || role === "patient") return role;
  if (role === "user") return "patient";
  return null;
}
