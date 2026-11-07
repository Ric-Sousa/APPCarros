// Dados por matrícula através do serviço PHP (vehicle_api.php).
// A resposta do PHP é convertida para os nomes de campo do formulário de veículos.
import { normalizeFuelType, type FuelType } from '@shared/fuel';
import { parseDateInput } from '@shared/schema';
import { HttpError } from '../http';

/** Resposta do vehicle_api.php (campos em texto, "Não encontrado" quando não há dados). */
interface PhpVehicleData {
  licensePlate?: string;
  brand?: string;
  model?: string;
  fuelType?: string;
  year?: string;
  cylinderCapacity?: string;
  engineDisplacement?: string;
  powerCV?: string;
  powerKW?: string;
  category?: string;
  iucCategory?: string;
  registrationDate?: string;
  inspectionValidity?: string;
  insuranceEnd?: string;
  entity?: string;
  origin?: string;
}

/** Dados já com os nomes do formulário; só vêm os campos conhecidos. */
export interface VehicleLookup {
  licensePlate: string;
  brand?: string;
  model?: string;
  year?: number;
  registrationDate?: string;
  fuelType?: FuelType;
  powerCV?: number;
  powerKW?: number;
  engineDisplacement?: number;
  iucCategory?: string;
  certifyingEntity?: string;
  vehicleCategory?: string;
  origin?: string;
  inspectionDue?: string;
  insuranceDue?: string;
}

const text = (v?: string) => {
  const s = v?.trim();
  return s && s !== 'Não encontrado' ? s : undefined;
};
/** Primeiro número do texto, com separadores de milhares ("1.995 cm3" -> 1995; "599 cm3" -> 599). */
const number = (v?: string) => {
  const match = text(v)?.match(/\d[\d .]*/);
  const n = match ? Number(match[0].replace(/[ .]/g, '')) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const isoDate = (v?: string) => {
  const d = parseDateInput(text(v));
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : undefined;
};

export function mapVehicleData(plate: string, d: PhpVehicleData): VehicleLookup {
  const out: VehicleLookup = {
    licensePlate: plate,
    brand: text(d.brand),
    model: text(d.model),
    year: number(d.year),
    registrationDate: text(d.registrationDate),
    fuelType: normalizeFuelType(text(d.fuelType)),
    powerCV: number(d.powerCV),
    powerKW: number(d.powerKW),
    engineDisplacement: number(d.engineDisplacement) ?? number(d.cylinderCapacity),
    iucCategory: text(d.iucCategory),
    certifyingEntity: text(d.entity),
    vehicleCategory: text(d.category),
    origin: text(d.origin),
    inspectionDue: isoDate(d.inspectionValidity),
    insuranceDue: isoDate(d.insuranceEnd),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as unknown as VehicleLookup;
}

export async function getVehicleByLicensePlate(plate: string): Promise<VehicleLookup | null> {
  const url = process.env.VEHICLE_API_URL;
  if (!url) throw new HttpError(503, 'A consulta de matrículas não está configurada (VEHICLE_API_URL).');

  let response: Response;
  try {
    response = await fetch(`${url}?license_plate=${encodeURIComponent(plate)}`, {
      headers: process.env.VEHICLE_API_KEY ? { 'X-Api-Key': process.env.VEHICLE_API_KEY } : {},
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    console.error(`Erro ao contactar o serviço de matrículas:`, error instanceof Error ? error.message : error);
    throw new HttpError(502, 'O serviço de consulta de matrículas não respondeu. Tente novamente mais tarde.');
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new HttpError(502, `O serviço de consulta de matrículas falhou (HTTP ${response.status}).`);

  const result = await response.json().catch(() => null);
  return result?.success && result.data ? mapVehicleData(plate, result.data) : null;
}

if (process.env.VEHICLE_API_URL && !process.env.VEHICLE_API_URL.startsWith('https://')) {
  console.warn('⚠️  VEHICLE_API_URL não usa HTTPS: as matrículas consultadas viajam sem encriptação.');
}
