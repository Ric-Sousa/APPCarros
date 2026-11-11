import { suggestIucDue, suggestInspectionDue, type DeadlineVehicleKind } from "@shared/deadlines";

/** Data de matrícula em qualquer formato usado na app: Date, ISO, "AAAA-MM-DD", "DD/MM/AAAA", "MM/AAAA", "AAAA". */
export function parseRegistrationDate(value: unknown): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const s = value.trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  if ((m = s.match(/^(\d{1,2})\/(\d{4})$/))) return new Date(Date.UTC(+m[2], +m[1] - 1, 1));
  if ((m = s.match(/^(\d{4})$/))) return new Date(Date.UTC(+m[1], 0, 1));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Tipo de veículo para as regras de inspeção, a partir da categoria (texto livre ou da matrícula). */
export function deadlineKind(vehicleCategory?: string | null, iucCategory?: string | null): DeadlineVehicleKind {
  const c = `${vehicleCategory ?? ""} ${iucCategory ?? ""}`.toLowerCase();
  if (/\bmot[ao]s?\b|motocicl|ciclomotor|motorizada|scooter|quadricicl|tricicl|categoria\s*e\b/.test(c)) return "motorcycle";
  if (/pesado|cami[aã]o|trator|tractor/.test(c)) return "truck";
  if (/mercadorias|furg|\bvan\b/.test(c)) return "van";
  return "car";
}

const iso = (d?: Date) => (d ? d.toISOString().slice(0, 10) : undefined);

/** Prazos sugeridos ("AAAA-MM-DD") a partir da data de matrícula; vazio quando não há regra. */
export function suggestDeadlines(registrationDate: unknown, vehicleCategory?: string | null, iucCategory?: string | null) {
  const reg = parseRegistrationDate(registrationDate);
  if (!reg) return {};
  return {
    iucDue: iso(suggestIucDue(reg)),
    inspectionDue: iso(suggestInspectionDue(reg, deadlineKind(vehicleCategory, iucCategory))),
  };
}
