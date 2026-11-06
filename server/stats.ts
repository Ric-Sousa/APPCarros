// Cálculos puros (sem BD), testados em server/stats.test.ts
import type { Vehicle } from '@shared/schema';

const DAY = 24 * 60 * 60 * 1000;

type FuelLike = { liters: string | number; mileage: number };
type ExpenseLike = { amount: string | number; date: Date | string };

/** Consumo médio em L/100km. O primeiro abastecimento só marca o ponto de partida. */
export function consumptionL100(records: FuelLike[]): number | null {
  if (records.length < 2) return null;
  const sorted = [...records].sort((a, b) => a.mileage - b.mileage);
  const distance = sorted[sorted.length - 1].mileage - sorted[0].mileage;
  if (distance <= 0) return null;
  const liters = sorted.slice(1).reduce((sum, r) => sum + Number(r.liters), 0);
  return Math.round((liters / distance) * 1000) / 10;
}

/** Média mensal das despesas dos últimos 12 meses. */
export function monthlyExpenses(expenses: ExpenseLike[], now = new Date()): number {
  const since = now.getTime() - 365 * DAY;
  const total = expenses
    .filter((e) => new Date(e.date).getTime() >= since)
    .reduce((sum, e) => sum + Number(e.amount), 0);
  return Math.round((total / 12) * 100) / 100;
}

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

/** Recomendações por regras a partir dos dados reais do veículo. */
export function vehicleRecommendations(v: Vehicle, now = new Date()): Recommendation[] {
  const recs: Recommendation[] = [];
  const km = v.currentMileage ?? 0;

  const byKm = (last: number | null, interval: number, warnKm: number, what: string, action: string, type: Recommendation['type']) => {
    if (last == null) return;
    const left = last + interval - km;
    if (left > warnKm) return;
    recs.push({
      type,
      priority: left <= 0 ? 'urgent' : 'high',
      title: left <= 0 ? `${what} em atraso` : `${what} em breve`,
      description: left <= 0 ? `Ultrapassou o intervalo recomendado em ${-left} km.` : `Faltam ${left} km para o intervalo recomendado.`,
      actionRequired: action,
    });
  };
  byKm(v.lastOilChangeMileage, v.oilChangeInterval || 15000, 1500, 'Mudança de óleo', 'Agendar mudança de óleo e filtro', 'maintenance');
  byKm(v.lastTireChangeMileage, v.tireChangeInterval || 40000, 3000, 'Troca de pneus', 'Verificar o desgaste e substituir os pneus', 'safety');

  const byDate = (due: Date | null, what: string, action: string, type: Recommendation['type']) => {
    if (!due) return;
    const days = Math.ceil((new Date(due).getTime() - now.getTime()) / DAY);
    if (days > 30) return;
    recs.push({
      type,
      priority: days <= 0 ? 'urgent' : days <= 7 ? 'high' : 'medium',
      title: days <= 0 ? `${what} expirado` : `${what} em ${days} dias`,
      description: days <= 0 ? `O prazo de ${what.toLowerCase()} já passou.` : `O prazo de ${what.toLowerCase()} termina em breve.`,
      actionRequired: action,
      deadline: new Date(due).toISOString().slice(0, 10),
    });
  };
  byDate(v.inspectionDue, 'Inspeção', 'Marcar a inspeção periódica', 'safety');
  byDate(v.iucDue, 'IUC', 'Pagar o Imposto Único de Circulação', 'cost_saving');
  byDate(v.insuranceDue, 'Seguro', 'Renovar ou comparar seguros', 'cost_saving');

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
