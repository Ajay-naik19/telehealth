"use client";

import { useQuery } from "@tanstack/react-query";
import { getUserProfile, type UserProfile } from "@/lib/api";

export function useUserProfileQuery() {
  return useQuery<{ profile: UserProfile | null }>({
    queryKey: ["profile", "patient"],
    queryFn: getUserProfile,
  });
}
