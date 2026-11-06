import { useQuery } from "@tanstack/react-query";
import type { Vehicle } from "@shared/schema";

/** The current user's vehicles (single definition of the /api/vehicles query). */
export function useVehicles() {
  return useQuery<Vehicle[]>({ queryKey: ["/api/vehicles"] });
}
