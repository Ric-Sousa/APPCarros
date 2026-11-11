import { useQuery } from "@tanstack/react-query";
import type { Vehicle } from "@shared/schema";

/** Veículo como vem da API: inclui o papel do utilizador (dono ou condutor de um veículo partilhado). */
export type VehicleWithRole = Vehicle & { role?: "owner" | "driver"; ownerName?: string };

/** The current user's vehicles (single definition of the /api/vehicles query). */
export function useVehicles() {
  return useQuery<VehicleWithRole[]>({ queryKey: ["/api/vehicles"] });
}

/** Só o dono apaga o veículo, gere a partilha e muda a foto. Sem `role` (API antiga) é o dono. */
export const isOwner = (v: { role?: string } | undefined) => !v?.role || v.role === "owner";
