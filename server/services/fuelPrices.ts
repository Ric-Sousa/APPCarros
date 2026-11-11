// Preços reais de combustível da DGEG (precoscombustiveis.dgeg.gov.pt).
// A API não pesquisa por localização: descarrega-se a lista nacional de cada combustível (cerca de 1 MB),
// guarda-se em cache e ordena-se por distância no servidor.
// Condições da DGEG: identificar a DGEG como fonte, mostrar a data/hora de atualização de cada preço e não alterar os valores.
// ponytail: API interna do site, sem documentação nem contrato; confirmar o uso comercial com a DGEG (pendente)
import type { FuelType } from '@shared/fuel';
import { haversineKm } from './externalApis';

const BASE = 'https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb';
const CACHE_MS = 6 * 3_600_000;
export const DGEG_ATTRIBUTION = 'Fonte: DGEG – Direção-Geral de Energia e Geologia (precoscombustiveis.dgeg.gov.pt)';

/** Ids da DGEG por tipo de combustível da app (sem preços para veículos elétricos e híbridos plug-in). */
export const DGEG_FUEL_IDS: Partial<Record<FuelType, number[]>> = {
  diesel: [2101],
  gasoline95: [3201],
  gasoline98: [3400, 3405],
  lpg: [1120],
  hybrid: [3201],
};

export interface Station {
  id: number;
  name: string;
  brand: string;
  address: string;
  municipality: string;
  district: string;
  lat: number;
  lng: number;
  price: number;
  fuelName: string;
  /** "AAAA-MM-DD HH:mm", hora de Portugal, como a DGEG publica */
  updatedAt: string;
}

const parsePrice = (s: unknown) => {
  const n = parseFloat(String(s ?? '').replace(/[^\d,.-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

async function getJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': 'Logicar/1.0' } });
  if (!res.ok) throw new Error(`DGEG: HTTP ${res.status}`);
  return res.json();
}

const cache = new Map<string, { at: number; data: Promise<Station[]> }>();

/** Todos os postos do país com preço para o combustível (com cache). */
export function nationalStations(fuel: FuelType): Promise<Station[]> {
  const ids = DGEG_FUEL_IDS[fuel];
  if (!ids) return Promise.resolve([]);
  const key = ids.join(',');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const data = getJson(`${BASE}/PesquisarPostos?idsTiposComb=${key}&idMarca=&idTipoPosto=&idDistrito=&idsMunicipios=&qtdPorPagina=5000&pagina=1`)
    .then((json): Station[] => (json?.status && Array.isArray(json.resultado) ? json.resultado : []).map((r: any) => ({
      id: Number(r.Id), name: String(r.Nome ?? ''), brand: String(r.Marca ?? ''), address: [r.Morada, r.CodPostal, r.Localidade].filter(Boolean).join(', '),
      municipality: String(r.Municipio ?? ''), district: String(r.Distrito ?? ''), lat: Number(r.Latitude), lng: Number(r.Longitude),
      price: parsePrice(r.Preco), fuelName: String(r.Combustivel ?? ''), updatedAt: String(r.DataAtualizacao ?? ''),
    })).filter((s: Station) => Number.isFinite(s.price) && Number.isFinite(s.lat) && Number.isFinite(s.lng)))
    .catch((error) => {
      cache.delete(key); // não guardar falhas
      throw error;
    });
  cache.set(key, { at: Date.now(), data });
  return data;
}

const averageCache = new Map<string, { at: number; data: Promise<{ price: number; date: string } | null> }>();

/** Preço médio nacional mais recente (DGEG). */
export function nationalAverage(fuel: FuelType): Promise<{ price: number; date: string } | null> {
  const ids = DGEG_FUEL_IDS[fuel];
  if (!ids) return Promise.resolve(null);
  const key = String(ids[0]);
  const hit = averageCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
  const data = getJson(`${BASE}/PMD?idsTiposComb=${key}&dataIni=${day(7)}&dataFim=${day(0)}&qtdPorPagina=10&pagina=1`)
    .then((json) => {
      const rows: any[] = json?.status && Array.isArray(json.resultado) ? json.resultado : [];
      const latest = rows.sort((a, b) => String(b.Data).localeCompare(String(a.Data)))[0];
      return latest ? { price: parsePrice(latest.PrecoMedio), date: String(latest.Data) } : null;
    })
    .catch(() => null);
  averageCache.set(key, { at: Date.now(), data });
  return data;
}

/** Postos num raio, do mais barato para o mais caro (desempate pela distância). */
export async function nearbyStations(fuel: FuelType, lat: number, lng: number, radiusKm: number, limit = 20) {
  const stations = await nationalStations(fuel);
  return stations
    .map((s) => ({ ...s, distance: Math.round(haversineKm({ lat, lng }, { lat: s.lat, lng: s.lng }) * 10) / 10 }))
    .filter((s) => s.distance <= radiusKm)
    .sort((a, b) => a.price - b.price || a.distance - b.distance)
    .slice(0, limit);
}
