"use client";

import { create } from "zustand";
import { can, type Action, type Resource } from "@/lib/rbac";
import type { AppUser } from "@/types/database";

// Lightweight client store for the current user profile. Hydrated once at the
// top of each dashboard layout from the server-fetched profile.
interface AuthState {
  user: AppUser | null;
  setUser: (user: AppUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

// usePermission(action, resource) -> boolean for the current user's role.
export function usePermission(action: Action, resource: Resource): boolean {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  return can(user.role, action, resource);
}
