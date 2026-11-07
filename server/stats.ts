// Cálculos puros (sem BD), testados em server/stats.test.ts
import type { Vehicle } from '@shared/schema';

const DAY = 24 * 60 * 60 * 1000;

export { consumptionL100, monthlyExpenses } from '@shared/calc';

/** Risco 0..1 de óleo, pneus e inspeção. */
export function predictiveRisk(v: Pick<Vehicle,
  'currentMileage' | 'lastOilChangeMileage' | 'oilChangeInterval' |
  'lastTireChangeMileage' | 'tireChangeInterval' | 'inspectionDue'>, now = new Date()) {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const kmRisk = (last?: number | null, interval?: number | null) =>
    last == null || !interval ? 0 : clamp(((v.currentMileage ?? 0) - last) / interval);

  let inspectionRisk = 0;
  if (v.inspectionDue) {
    const daysLeft = Math.ceil((new Date(v.inspectionDue).getTime() - now.getTime()) / DAY);
    inspectionRisk = daysLeft <= 0 ? 1 : clamp((365 - daysLeft) / 365);
  }
  return {
    oilRisk: kmRisk(v.lastOilChangeMileage, v.oilChangeInterval),
    tireRisk: kmRisk(v.lastTireChangeMileage, v.tireChangeInterval),
    inspectionRisk,
  };
}

export interface Recommendation {
  type: 'maintenance' | 'efficiency' | 'cost_saving' | 'safety';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  estimatedSavings?: number;
  actionRequired: string;
  deadline?: string;
}

export type DueKind = 'oil_change' | 'tire_change' | 'inspection' | 'iuc' | 'insurance';

/** Algo do veículo que está a vencer (por km ou por data). Base dos alertas e das recomendações. */
export interface DueItem {
  kind: DueKind;
  overdue: boolean;
  urgency: 'urgent' | 'high' | 'normal';
  title: string;
  description: string;
  action: string;
  dueMileage: number | null;
  dueDate: Date | null;
}

const KM_RULES: { kind: DueKind; what: string; action: string; last: keyof Vehicle; interval: keyof Vehicle; defaultInterval: number; warnKm: number }[] = [
  { kind: 'oil_change', what: 'Mudança de óleo', action: 'Agendar mudança de óleo e filtro', last: 'lastOilChangeMileage', interval: 'oilChangeInterval', defaultInterval: 15000, warnKm: 1500 },
  { kind: 'tire_change', what: 'Troca de pneus', action: 'Verificar o desgaste e substituir os pneus', last: 'lastTireChangeMileage', interval: 'tireChangeInterval', defaultInterval: 40000, warnKm: 3000 },
];
const DATE_RULES: { kind: DueKind; what: string; action: string; field: keyof Vehicle }[] = [
  { kind: 'inspection', what: 'Inspeção', action: 'Marcar a inspeção periódica', field: 'inspectionDue' },
  { kind: 'iuc', what: 'IUC', action: 'Pagar o Imposto Único de Circulação', field: 'iucDue' },
  { kind: 'insurance', what: 'Seguro', action: 'Renovar ou comparar seguros', field: 'insuranceDue' },
];

/** Prazos a vencer: por km a menos de warnKm, por data a menos de 30 dias (ou já passados). */
export function dueItems(v: Vehicle, now = new Date()): DueItem[] {
  const items: DueItem[] = [];
  const km = v.currentMileage ?? 0;
  for (const r of KM_RULES) {
    const last = v[r.last] as number | null;
    if (last == null) continue;
    const dueMileage = last + ((v[r.interval] as number | null) || r.defaultInterval);
    const left = dueMileage - km;
    if (left > r.warnKm) continue;
    items.push({
      kind: r.kind,
      overdue: left <= 0,
      urgency: left <= 0 ? 'urgent' : left <= r.warnKm / 3 ? 'high' : 'normal',
      title: left <= 0 ? `${r.what} em atraso` : `${r.what} em breve`,
      description: left <= 0 ? `Ultrapassou o intervalo recomendado em ${-left} km.` : `Faltam ${left} km para o intervalo recomendado.`,
      action: r.action,
      dueMileage,
      dueDate: null,
    });
  }
  for (const r of DATE_RULES) {
    const due = v[r.field] as Date | null;
    if (!due) continue;
    const days = Math.ceil((new Date(due).getTime() - now.getTime()) / DAY);
    if (days > 30) continue;
    items.push({
      kind: r.kind,
      overdue: days <= 0,
      urgency: days <= 0 ? 'urgent' : days <= 7 ? 'high' : 'normal',
      title: days <= 0 ? `${r.what} expirado` : `${r.what} em ${days} dias`,
      description: days <= 0 ? `O prazo de ${r.what.toLowerCase()} já passou.` : `O prazo de ${r.what.toLowerCase()} termina em breve.`,
      action: r.action,
      dueMileage: null,
      dueDate: new Date(due),
    });
  }
  return items;
}

/** Id estável do alerta: muda quando o prazo muda (ex.: depois de uma nova mudança de óleo). */
export const alertId = (vehicleId: string, item: DueItem) =>
  `${vehicleId}:${item.kind}:${item.dueMileage ?? item.dueDate!.toISOString().slice(0, 10)}`;

const REC_TYPE: Record<DueKind, Recommendation['type']> = {
  oil_change: 'maintenance', tire_change: 'safety', inspection: 'safety', iuc: 'cost_saving', insurance: 'cost_saving',
};

/** Recomendações por regras a partir dos dados reais do veículo. */
export function vehicleRecommendations(v: Vehicle, now = new Date()): Recommendation[] {
  const recs: Recommendation[] = dueItems(v, now).map((item) => ({
    type: REC_TYPE[item.kind],
    // nas recomendações, prazos por km ainda não vencidos são "high" (como antes)
    priority: item.urgency === 'normal' ? (item.dueDate ? 'medium' : 'high') : item.urgency,
    title: item.title,
    description: item.description,
    actionRequired: item.action,
    deadline: item.dueDate ? item.dueDate.toISOString().slice(0, 10) : undefined,
  }));

  if (recs.length === 0) {
    recs.push({
      type: 'maintenance',
      priority: 'low',
      title: 'Sem ações pendentes',
      description: 'Manutenção e prazos em dia com base nos dados registados.',
      actionRequired: 'Manter os registos atualizados',
    });
  }
  const order = { urgent: 0, high: 1, medium: 2, low: 3 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]);
}
