// APIs externas. Quando uma fonte real não está configurada, devolve valores de referência
// fixos e marca o resultado com `demo: true`, para a interface o poder indicar.
import axios from 'axios';
import type { Vehicle } from '@shared/schema';
import { vehicleRecommendations, type Recommendation } from '../stats';

export interface FuelPriceData {
  station: string;
  location: string;
  address: string;
  gasoline95: number;
  gasoline98: number;
  diesel: number;
  distance: number;
  lastUpdated: string;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  condition: string;
  impact: 'low' | 'medium' | 'high';
  recommendations: string[];
}

export interface MaintenancePartPrices {
  oilPrices: Array<{ brand: string; type: string; price: number; shop: string; availability: boolean }>;
  tirePrices: Array<{ brand: string; size: string; price: number; shop: string; stock: number }>;
}

export interface Sourced<T> {
  data: T;
  /** true = valores de referência/demonstração, não dados em tempo real */
  demo: boolean;
}

const key = (name: string) => {
  const value = process.env[name];
  return value && !value.startsWith('your_') ? value : undefined;
};

// ponytail: tabela fixa de referência até haver integração com a API da DGEG (precoscombustiveis.dgeg.gov.pt)
const REFERENCE_FUEL_PRICES: FuelPriceData[] = [
  { station: 'Galp', location: 'Porto Centro', address: 'Rua de Santa Catarina', gasoline95: 1.639, gasoline98: 1.789, diesel: 1.449, distance: 0.8, lastUpdated: '' },
  { station: 'BP', location: 'Porto Norte', address: 'Av. da Boavista', gasoline95: 1.629, gasoline98: 1.779, diesel: 1.439, distance: 1.2, lastUpdated: '' },
  { station: 'Repsol', location: 'Matosinhos', address: 'Rua da Fonte', gasoline95: 1.644, gasoline98: 1.784, diesel: 1.454, distance: 1.5, lastUpdated: '' },
  { station: 'Intermarché', location: 'Porto Sul', address: 'Arrábida', gasoline95: 1.619, gasoline98: 1.769, diesel: 1.424, distance: 2.1, lastUpdated: '' },
];

const REFERENCE_MAINTENANCE_PRICES: MaintenancePartPrices = {
  oilPrices: [
    { brand: 'Castrol GTX', type: '5W-30', price: 45.99, shop: 'Norauto', availability: true },
    { brand: 'Mobil 1', type: '5W-30', price: 52.99, shop: 'Feu Vert', availability: true },
    { brand: 'Shell Helix', type: '5W-30', price: 41.99, shop: 'Auto5', availability: true },
  ],
  tirePrices: [
    { brand: 'Michelin Energy Saver', size: '205/55R16', price: 89.99, shop: 'Norauto', stock: 4 },
    { brand: 'Continental EcoContact', size: '205/55R16', price: 82.99, shop: 'Feu Vert', stock: 2 },
  ],
};

export function getFuelPrices(): Sourced<FuelPriceData[]> {
  return { data: [...REFERENCE_FUEL_PRICES].sort((a, b) => a.gasoline95 - b.gasoline95), demo: true };
}

export function getMaintenancePrices(): Sourced<MaintenancePartPrices> {
  return { data: REFERENCE_MAINTENANCE_PRICES, demo: true };
}

export async function getWeatherImpact(location: string): Promise<Sourced<WeatherData>> {
  const apiKey = key('OPENWEATHER_API_KEY');
  if (apiKey) {
    try {
      const { data } = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
        params: { q: `${location},PT`, appid: apiKey, units: 'metric', lang: 'pt' },
        timeout: 10_000,
      });
      const temperature = Math.round(data.main.temp);
      const humidity = data.main.humidity;
      const condition = String(data.weather[0].main).toLowerCase();
      return {
        data: { temperature, humidity, condition, impact: weatherImpact(temperature, humidity, condition), recommendations: weatherRecommendations(temperature, humidity, condition) },
        demo: false,
      };
    } catch (error) {
      console.error('Erro na API OpenWeather:', error instanceof Error ? error.message : error);
    }
  }
  return {
    data: { temperature: 18, humidity: 65, condition: 'indisponível', impact: 'low', recommendations: ['Dados meteorológicos indisponíveis: configure OPENWEATHER_API_KEY.'] },
    demo: true,
  };
}

const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const h = Math.sin(toRad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
export { haversineKm };

/** Rota por coordenadas via OpenRouteService; sem chave, distância em linha reta. */
export async function getRouteByCoords(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
): Promise<{ distanceKm: number; durationMin: number; geometry?: unknown }> {
  const apiKey = key('OPENROUTESERVICE_API_KEY');
  if (apiKey) {
    try {
      const { data } = await axios.get('https://api.openrouteservice.org/v2/directions/driving-car', {
        params: { api_key: apiKey, start: `${start.lng},${start.lat}`, end: `${end.lng},${end.lat}` },
        timeout: 15_000,
      });
      const feature = data.features?.[0];
      const summary = feature?.properties?.summary ?? data.routes?.[0]?.summary;
      if (summary) {
        return {
          distanceKm: Number((summary.distance / 1000).toFixed(2)),
          durationMin: Math.round(summary.duration / 60),
          geometry: feature?.geometry ?? data.routes?.[0]?.geometry,
        };
      }
    } catch (error) {
      console.error('Erro na API OpenRouteService:', error instanceof Error ? error.message : error);
    }
  }
  return { distanceKm: Number(haversineKm(start, end).toFixed(2)), durationMin: 0 };
}

// O Nominatim só permite 1 pedido por segundo por servidor: os pedidos esperam pela sua vez
let nominatimNext = 0;
async function nominatimTurn() {
  const wait = Math.max(0, nominatimNext - Date.now());
  nominatimNext = Date.now() + wait + 1100;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

/** Geocoding (OpenRouteService com chave, senão Nominatim). */
export async function geocodeText(q: string): Promise<Array<{ lat: number; lng: number; label: string }>> {
  try {
    const apiKey = key('OPENROUTESERVICE_API_KEY');
    if (apiKey) {
      const { data } = await axios.get('https://api.openrouteservice.org/geocode/search', {
        params: { api_key: apiKey, text: q, boundary_country: 'PT', size: 5 },
        timeout: 10_000,
      });
      return (data?.features ?? []).map((f: any) => ({
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        label: f.properties.label || f.properties.name || q,
      }));
    }
    await nominatimTurn();
    const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { format: 'json', q, limit: 5 },
      headers: { 'Accept-Language': 'pt', 'User-Agent': 'LogiCar/1.0' },
      timeout: 10_000,
    });
    return (data ?? []).map((d: any) => ({ lat: parseFloat(d.lat), lng: parseFloat(d.lon), label: d.display_name }));
  } catch (error) {
    console.error('Erro no geocoding:', error instanceof Error ? error.message : error);
    return [];
  }
}

export function getRecommendations(vehicle: Vehicle): Recommendation[] {
  return vehicleRecommendations(vehicle);
}

export async function getEnhancedRecommendations(vehicle: Vehicle, location: string) {
  const fuel = getFuelPrices();
  const weather = await getWeatherImpact(location);
  const maintenance = getMaintenancePrices();
  const insights = getRecommendations(vehicle);
  const prices = fuel.data;
  const cheapest = prices[0];
  const priciest = prices[prices.length - 1];

  return {
    demo: fuel.demo || weather.demo || maintenance.demo,
    data: {
      fuelOptimization: {
        cheapestStation: cheapest,
        potentialSavings: ((priciest.gasoline95 - cheapest.gasoline95) / priciest.gasoline95) * 100,
        recommendations: [
          `Posto mais económico (referência): ${cheapest.station} (${cheapest.gasoline95}€/L)`,
          `Diferença entre postos: ${(priciest.gasoline95 - cheapest.gasoline95).toFixed(3)}€ por litro`,
        ],
      },
      weatherImpact: weather.data,
      maintenanceCosts: maintenance.data,
      aiInsights: insights,
      summary: {
        totalPotentialSavings: insights.reduce((sum, r) => sum + (r.estimatedSavings ?? 0), 0),
        urgentActions: insights.filter((r) => r.priority === 'urgent').length,
        nextRecommendedAction: insights[0]?.actionRequired ?? 'Nenhuma ação urgente',
      },
    },
  };
}

function weatherRecommendations(temp: number, humidity: number, condition: string): string[] {
  const recs: string[] = [];
  if (temp < 10) recs.push('Temperatura baixa: verifique a pressão dos pneus e o anticongelante.');
  else if (temp > 30) recs.push('Temperatura elevada: verifique o líquido de refrigeração.');
  else recs.push('Temperatura favorável a um consumo eficiente.');
  if (humidity > 80) recs.push('Humidade elevada: atenção ao embaciamento dos vidros.');
  if (condition.includes('rain')) recs.push('Chuva: reduza a velocidade e aumente a distância de segurança.');
  else if (condition.includes('snow')) recs.push('Neve ou gelo: considere pneus de inverno ou correntes.');
  return recs;
}

function weatherImpact(temp: number, humidity: number, condition: string): 'low' | 'medium' | 'high' {
  let score = 0;
  if (temp < 5 || temp > 35) score += 2;
  else if (temp < 10 || temp > 30) score += 1;
  if (humidity > 90 || humidity < 30) score += 1;
  if (condition.includes('snow') || condition.includes('storm')) score += 2;
  else if (condition.includes('rain') || condition.includes('fog')) score += 1;
  return score >= 3 ? 'high' : score >= 1 ? 'medium' : 'low';
}
