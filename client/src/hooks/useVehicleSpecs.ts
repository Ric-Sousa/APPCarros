import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, post } from '@/lib/apiUtils';

export interface AutocompleteResult {
  value: string;
  label: string;
  category: 'oil' | 'tire';
}

export interface VehicleRecommendations {
  oilRecommendations: {
    recommendedType: string;
    recommendedBrands: string[];
    capacity: string;
    intervalKm: number;
    intervalMonths: number;
    description: string;
  };
  tireRecommendations: {
    recommendedSize: string;
    recommendedBrands: string[];
    intervalKm: number;
    description: string;
  };
  found: boolean;
}

export interface OilIntervalInfo {
  intervalKm: number;
  intervalMonths: number;
  description: string;
}

/** Value that only changes after `delay` ms without changes (for typing). */
export function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Sugestões de marcas de óleo/pneus enquanto o utilizador escreve. */
export function useAutocomplete(query: string, type: 'oil' | 'tire' | 'both', minLength = 2) {
  const q = useDebounced(query.trim(), 300);
  const { data, isFetching } = useQuery<AutocompleteResult[]>({
    queryKey: ['/api/autocomplete', type, q],
    queryFn: () => get<AutocompleteResult[]>(`/api/autocomplete/${type}?q=${encodeURIComponent(q)}`),
    enabled: q.length >= minLength,
  });
  return { suggestions: q.length >= minLength ? data ?? [] : [], loading: isFetching };
}

/** Recomendações de óleo e pneus para marca/modelo (/api/vehicle-specs). */
export function useVehicleSpecs(brand: string, model: string) {
  return useQuery<VehicleRecommendations>({
    queryKey: ['/api/vehicle-specs', brand, model],
    queryFn: () => get<VehicleRecommendations>(`/api/vehicle-specs/${encodeURIComponent(brand)}/${encodeURIComponent(model)}`),
    enabled: !!brand && !!model,
  });
}

/** Intervalo de mudança de óleo para uma marca de óleo (null se falhar). */
export async function fetchOilInterval(oilBrand: string, vehicleBrand: string, vehicleModel: string): Promise<OilIntervalInfo | null> {
  try {
    return await post<OilIntervalInfo>('/api/oil-interval', { oilBrand, vehicleBrand, vehicleModel });
  } catch {
    return null;
  }
}
