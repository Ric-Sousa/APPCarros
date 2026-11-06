import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/apiUtils";
import type { FuelRecord } from "@shared/schema";

/** Fuel record form fields (shared by FuelConsumption page and VehicleFuelManagement). */
export const fuelFormSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  mileage: z.coerce.number<number>().min(0, "Quilometragem deve ser positiva"),
  liters: z.coerce.number<number>().min(0.1, "Mínimo 0.1 litros"),
  costPerLiter: z.coerce.number<number>().min(0, "Preço deve ser positivo"),
  totalCost: z.coerce.number<number>().min(0, "Total deve ser positivo"),
  fuelType: z.string().min(1, "Tipo de combustível é obrigatório"),
  gasStationName: z.string().optional(),
  gasStationLocation: z.string().optional(),
  fullTank: z.boolean().default(false),
  notes: z.string().optional(),
});

export type FuelFormData = z.infer<typeof fuelFormSchema>;

/** Fuel records of one vehicle. All mutations invalidate ['/api/fuel-records']. */
export function useFuelRecords(vehicleId: string) {
  return useQuery<FuelRecord[]>({
    queryKey: ["/api/fuel-records", vehicleId],
    queryFn: () => get<FuelRecord[]>(`/api/fuel-records?vehicleId=${encodeURIComponent(vehicleId)}`),
    enabled: !!vehicleId,
  });
}
