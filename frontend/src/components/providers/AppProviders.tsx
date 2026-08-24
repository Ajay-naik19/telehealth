"use client";

import { AuthProvider } from "@/contexts/auth-context";
import GlobalLoadingBar from "@/components/GlobalLoadingBar";
import QueryProvider from "./QueryProvider";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <GlobalLoadingBar />
        {children}
      </AuthProvider>
    </QueryProvider>
  );
}
