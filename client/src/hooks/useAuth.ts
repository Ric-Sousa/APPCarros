import { useQuery } from "@tanstack/react-query";
import { get, getAccessToken, refreshSession } from "@/lib/apiUtils";
import type { User } from "@shared/schema";
import type { PlanId } from "@shared/plans";

export type PublicUser = Omit<User, "password" | "totpSecret" | "calendarToken" | "plan"> & {
  plan: PlanId;
  isAdmin?: boolean;
};

export const AUTH_USER_KEY = ["/api/auth/user"];

/**
 * Utilizador da sessão. No arranque (sem token em memória) restaura a sessão a partir do cookie;
 * sem sessão devolve null sem erro.
 */
export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: AUTH_USER_KEY,
    queryFn: async () => {
      if (!getAccessToken() && !(await refreshSession())) return null;
      return get<PublicUser>("/api/auth/user");
    },
    staleTime: Infinity,
  });

  return {
    user: user ?? undefined,
    isLoading,
    isAuthenticated: !!user,
  };
}
