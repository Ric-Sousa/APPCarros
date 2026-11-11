import { useQuery } from "@tanstack/react-query";
import type { Plan, PlanId } from "@shared/plans";
import { get } from "@/lib/apiUtils";

export interface AppConfig {
  appName: string;
  features: {
    plateLookup: boolean;
    iot: boolean;
    push: boolean;
    payments: "stripe" | "dev" | "none";
    fuelPrices: boolean;
  };
  vapidPublicKey: string | null;
  plans: Record<PlanId, Plan>;
  attributions: { name: string; url: string; note?: string }[];
}

/** Configuração pública do servidor (funcionalidades ativas, planos, atribuições). Pode ser undefined enquanto carrega. */
export function useConfig(): AppConfig | undefined {
  const { data } = useQuery({
    queryKey: ["/api/config"],
    queryFn: () => get<AppConfig>("/api/config"),
    staleTime: 10 * 60 * 1000,
  });
  return data;
}
