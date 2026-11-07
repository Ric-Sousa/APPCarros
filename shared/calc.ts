// Cálculos partilhados entre o cliente e o servidor (o mesmo resultado em todo o lado).

const DAY = 24 * 60 * 60 * 1000;

type FuelLike = { liters: string | number; mileage: number; fullTank?: boolean | null };
type ExpenseLike = { amount: string | number; date: Date | string };

/**
 * Consumo médio em L/100km entre o primeiro e o último abastecimento.
 * O primeiro abastecimento só marca o ponto de partida (o combustível dele foi gasto antes).
 * Devolve null com menos de 2 registos ou sem distância percorrida.
 */
export function consumptionL100(records: FuelLike[]): number | null {
  if (records.length < 2) return null;
  const sorted = [...records].sort((a, b) => a.mileage - b.mileage);
  const distance = sorted[sorted.length - 1].mileage - sorted[0].mileage;
  if (distance <= 0) return null;
  const liters = sorted.slice(1).reduce((sum, r) => sum + Number(r.liters), 0);
  return Math.round((liters / distance) * 1000) / 10;
}

/** Média mensal das despesas dos últimos 12 meses (meses sem despesas contam). */
export function monthlyExpenses(expenses: ExpenseLike[], now = new Date()): number {
  const since = now.getTime() - 365 * DAY;
  const total = expenses
    .filter((e) => new Date(e.date).getTime() >= since)
    .reduce((sum, e) => sum + Number(e.amount), 0);
  return Math.round((total / 12) * 100) / 100;
}
