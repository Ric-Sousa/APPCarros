// Tipos de combustível: um só conjunto de códigos para toda a aplicação (cliente, servidor e BD).

export const FUEL_TYPES = [
  { code: 'gasoline95', label: 'Gasolina 95' },
  { code: 'gasoline98', label: 'Gasolina 98' },
  { code: 'diesel', label: 'Gasóleo' },
  { code: 'electric', label: 'Elétrico' },
  { code: 'hybrid', label: 'Híbrido' },
  { code: 'lpg', label: 'GPL' },
] as const;

export type FuelType = (typeof FUEL_TYPES)[number]['code'];
export const FUEL_CODES = FUEL_TYPES.map((f) => f.code) as [FuelType, ...FuelType[]];

/**
 * Converte qualquer valor antigo ou texto livre (ex.: "Gasóleo", "Gasolina", "gasoline", "gas",
 * "gasoline_98", dados da matrícula) para um código. Devolve undefined se não reconhecer.
 */
export function normalizeFuelType(value: unknown): FuelType | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (!v) return undefined;
  if ((FUEL_CODES as string[]).includes(v)) return v as FuelType;
  if (/hibrid|hybrid|plug/.test(v)) return 'hybrid';
  if (/eletric|electric|^ev$|bateria/.test(v)) return 'electric';
  if (/gpl|lpg|glp/.test(v)) return 'lpg';
  if (/diesel|gasoleo/.test(v)) return 'diesel';
  if (/98/.test(v)) return 'gasoline98';
  if (/gasolina|gasoline|^gas$|petrol|95/.test(v)) return 'gasoline95';
  return undefined;
}

/** Rótulo em pt-PT para qualquer valor guardado (incluindo valores antigos). */
export function fuelLabel(value: unknown): string {
  const code = normalizeFuelType(value);
  return code ? FUEL_TYPES.find((f) => f.code === code)!.label : typeof value === 'string' && value ? value : 'Não definido';
}

export const isElectric = (value: unknown) => normalizeFuelType(value) === 'electric';
