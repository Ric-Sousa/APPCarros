import { useQuery } from "@tanstack/react-query";
import { get, getAuthToken } from "@/lib/apiUtils";
import type { User } from "@shared/schema";

export type PublicUser = Omit<User, "password">;

export function useAuth() {
  const hasToken = !!getAuthToken();
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: () => get<PublicUser>("/api/auth/user"),
    enabled: hasToken,
  });

  return {
    user,
    isLoading: hasToken && isLoading,
    isAuthenticated: !!user,
  };
}
