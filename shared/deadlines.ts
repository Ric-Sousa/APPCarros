// Prazos legais calculados a partir da data da matrícula (Portugal).
// Servem de sugestão: o utilizador pode sempre corrigir.
// ponytail: regras simplificadas; confirmar com o IMT para casos especiais (táxis, TVDE, veículos importados, motociclos)

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const lastDayOfMonth = (y: number, m: number) => utc(y, m + 1, 0);

export type DeadlineVehicleKind = 'car' | 'van' | 'truck' | 'motorcycle';

/**
 * IUC: paga-se durante o mês da matrícula, todos os anos. Devolve o último dia desse mês
 * na próxima ocorrência (hoje incluído).
 */
export function suggestIucDue(registrationDate: Date | string | null | undefined, now = new Date()): Date | undefined {
  if (!registrationDate) return undefined;
  const reg = new Date(registrationDate);
  if (Number.isNaN(reg.getTime())) return undefined;
  const month = reg.getUTCMonth();
  let due = lastDayOfMonth(now.getUTCFullYear(), month);
  if (due.getTime() < utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()).getTime()) {
    due = lastDayOfMonth(now.getUTCFullYear() + 1, month);
  }
  return due;
}

/** Idades (em anos desde a matrícula) em que há inspeção, antes de passar a anual. */
const INSPECTION_SCHEDULE: Record<DeadlineVehicleKind, { first: number; every: number; annualFrom: number } | null> = {
  // Ligeiros de passageiros: aos 4 anos, depois de 2 em 2 até aos 8, depois todos os anos
  car: { first: 4, every: 2, annualFrom: 8 },
  // Ligeiros de mercadorias: aos 2 anos, depois todos os anos
  van: { first: 2, every: 1, annualFrom: 2 },
  // Pesados: todos os anos desde o primeiro ano
  truck: { first: 1, every: 1, annualFrom: 1 },
  // Motociclos: regras próprias e recentes; sem sugestão automática
  motorcycle: null,
};

/**
 * Próxima inspeção periódica: no dia e mês da matrícula, no primeiro ano obrigatório
 * que ainda não passou. Devolve undefined quando não há regra para o tipo de veículo.
 */
export function suggestInspectionDue(
  registrationDate: Date | string | null | undefined,
  kind: DeadlineVehicleKind = 'car',
  now = new Date(),
): Date | undefined {
  const rule = INSPECTION_SCHEDULE[kind];
  if (!registrationDate || !rule) return undefined;
  const reg = new Date(registrationDate);
  if (Number.isNaN(reg.getTime())) return undefined;
  const today = utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()).getTime();
  const at = (age: number) => utc(reg.getUTCFullYear() + age, reg.getUTCMonth(), reg.getUTCDate());

  for (let age = rule.first; age < 200; age += age >= rule.annualFrom ? 1 : rule.every) {
    if (at(age).getTime() >= today) return at(age);
  }
  return undefined;
}

/** Depois de cumprido um prazo, quando é o seguinte. */
export function nextDeadlineAfter(kind: 'iuc' | 'insurance' | 'inspection', previousDue: Date, registrationDate?: Date | string | null, vehicleKind: DeadlineVehicleKind = 'car', now = new Date()): Date {
  if (kind === 'inspection') {
    // calcula a partir do dia seguinte ao prazo cumprido
    const after = new Date(Math.max(previousDue.getTime(), now.getTime()) + 86_400_000);
    const next = suggestInspectionDue(registrationDate, vehicleKind, after);
    if (next) return next;
  }
  const d = new Date(previousDue);
  return utc(d.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate());
}
