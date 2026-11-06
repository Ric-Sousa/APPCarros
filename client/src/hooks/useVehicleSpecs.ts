import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

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

// Hook para autocomplete
export const useAutocomplete = (query: string, type: 'oil' | 'tire' | 'both', minLength: number = 2) => {
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < minLength) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setLoading(true);
      try {
        const response = await apiRequest('GET', `/api/autocomplete/${type}?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        setSuggestions(data);
      } catch (error) {
        console.error('Error fetching autocomplete:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [query, type, minLength]);

  return { suggestions, loading };
};

// Hook para recomendações de veículo
export const useVehicleRecommendations = (brand: string, model: string) => {
  const [recommendations, setRecommendations] = useState<VehicleRecommendations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!brand || !model) {
      setRecommendations(null);
      setError(null);
      return;
    }

    const fetchRecommendations = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiRequest('GET', `/api/vehicle-specs/${encodeURIComponent(brand)}/${encodeURIComponent(model)}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setRecommendations(data);
      } catch (error) {
        console.error('❌ Error fetching vehicle recommendations:', error);
        setError(error instanceof Error ? error.message : 'Erro desconhecido');
        
        // Fallback para recomendações genéricas
        setRecommendations({
          found: false,
          oilRecommendations: {
            recommendedType: "5W-30 ou 10W-40",
            recommendedBrands: ["Castrol", "Mobil 1", "Shell", "Total"],
            capacity: "Consulte manual",
            intervalKm: 10000,
            intervalMonths: 12,
            description: "Recomendações genéricas. Consulte o manual do proprietário para especificações exatas."
          },
          tireRecommendations: {
            recommendedSize: "Consulte manual",
            recommendedBrands: ["Michelin", "Continental", "Bridgestone", "Pirelli"],
            intervalKm: 50000,
            description: "Recomendações genéricas. Verifique a medida no pneu atual ou manual do veículo."
          }
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [brand, model]);

  return { recommendations, loading, error };
};

// Hook para informações de intervalo de óleo
export const useOilInterval = () => {
  const [intervalInfo, setIntervalInfo] = useState<OilIntervalInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchOilInterval = async (oilBrand: string, vehicleBrand: string, vehicleModel: string) => {
    setLoading(true);
    try {
      const response = await apiRequest('POST', '/api/oil-interval', {
        oilBrand,
        vehicleBrand,
        vehicleModel
      });
      const data = await response.json();
      setIntervalInfo(data);
      return data;
    } catch (error) {
      console.error('Error fetching oil interval:', error);
      setIntervalInfo(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { intervalInfo, loading, fetchOilInterval };
};
