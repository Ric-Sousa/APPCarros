import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/apiUtils";
import { consumptionL100 } from "@shared/calc";
import type { FuelRecord } from "@shared/schema";

/** Campos do formulário de abastecimento (página Combustível e página do veículo). */
export const fuelFormSchema = z.object({
  vehicleId: z.string().min(1, "Veículo é obrigatório"),
  date: z.string().min(1, "Data é obrigatória"),
  mileage: z.coerce.number<number>().int().min(0, "Quilometragem inválida"),
  liters: z.coerce.number<number>().min(0.1, "Mínimo 0,1 litros"),
  costPerLiter: z.coerce.number<number>().min(0, "Preço inválido"),
  totalCost: z.coerce.number<number>().min(0, "Total inválido"),
  fuelType: z.string().min(1, "Tipo de combustível é obrigatório"),
  gasStationName: z.string().optional(),
  gasStationLocation: z.string().optional(),
  fullTank: z.boolean(),
  notes: z.string().optional(),
});
export type FuelFormData = z.infer<typeof fuelFormSchema>;

/** Query keys a invalidar depois de criar/editar/apagar abastecimentos. */
export const FUEL_KEYS = [["/api/fuel-records"], ["/api/vehicles"], ["/api/stats"]];

/** Abastecimentos de um veículo. */
export function useFuelRecords(vehicleId: string) {
  return useQuery<FuelRecord[]>({
    queryKey: ["/api/fuel-records", vehicleId],
    queryFn: () => get<FuelRecord[]>(`/api/fuel-records?vehicleId=${encodeURIComponent(vehicleId)}`),
    enabled: !!vehicleId,
  });
}

/** Todos os abastecimentos do utilizador (uma só consulta partilhada). */
export function useAllFuelRecords() {
  return useQuery<FuelRecord[]>({ queryKey: ["/api/fuel-records", "all"], queryFn: () => get<FuelRecord[]>("/api/fuel-records") });
}

export interface FuelStats {
  count: number;
  totalLiters: number;
  totalCost: number;
  totalDistance: number;
  /** L/100km (fórmula partilhada com o servidor); null com menos de 2 registos */
  avgConsumption: number | null;
  avgCostPerLiter: number;
  costPer100km: number | null;
  monthly: { month: string; cost: number; liters: number; count: number }[];
}

/** Estatísticas de abastecimentos: uma só fórmula para toda a aplicação. */
export function computeFuelStats(records: FuelRecord[]): FuelStats | null {
  if (records.length === 0) return null;
  const totalLiters = records.reduce((s, r) => s + Number(r.liters), 0);
  const totalCost = records.reduce((s, r) => s + Number(r.totalCost), 0);
  const mileages = records.map((r) => r.mileage);
  const totalDistance = Math.max(...mileages) - Math.min(...mileages);
  const monthlyMap = new Map<string, { cost: number; liters: number; count: number }>();
  for (const r of records) {
    const month = new Date(r.date).toISOString().slice(0, 7);
    const m = monthlyMap.get(month) ?? { cost: 0, liters: 0, count: 0 };
    m.cost += Number(r.totalCost);
    m.liters += Number(r.liters);
    m.count += 1;
    monthlyMap.set(month, m);
  }
  return {
    count: records.length,
    totalLiters,
    totalCost,
    totalDistance,
    avgConsumption: consumptionL100(records),
    avgCostPerLiter: totalLiters > 0 ? totalCost / totalLiters : 0,
    costPer100km: totalDistance > 0 ? (totalCost / totalDistance) * 100 : null,
    monthly: [...monthlyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, m]) => ({ month, ...m })),
  };
}
