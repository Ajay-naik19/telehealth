"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getSession,
  login as loginService,
  logout as logoutService,
  signup as signupService,
  type AuthUser,
} from "@/services/auth.client";
import type { AppRole } from "@/config/routes";

type AuthContextValue = {
  user: AuthUser | null;
  role: AppRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  profileComplete: boolean;
  refreshSession: () => Promise<void>;
  login: (role: AppRole, phone: string, password: string) => Promise<AuthUser>;
  signup: (role: AppRole, phone: string, password: string, confirmpassword: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const session = await getSession();
      setUser(session.authenticated ? session.user : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        const session = await getSession();
        if (!mounted) return;
        setUser(session.authenticated ? session.user : null);
      } catch {
        if (!mounted) return;
        setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    boot();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (role: AppRole, phone: string, password: string) => {
    const nextUser = await loginService(role, phone, password);
    setUser(nextUser);
    return nextUser;
  }, []);

  const signup = useCallback(async (role: AppRole, phone: string, password: string, confirmpassword: string) => {
    const nextUser = await signupService(role, phone, password, confirmpassword);
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    await logoutService();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: Boolean(user),
      isLoading,
      profileComplete: Boolean(user?.profileComplete),
      refreshSession,
      login,
      signup,
      logout,
    }),
    [isLoading, login, logout, refreshSession, signup, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
