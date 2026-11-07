import type { ExpenseRecord } from "@shared/schema";
import { formatDate } from "@/lib/utils";

/** Categorias de despesa (formulário, filtros, listas e análise usam esta lista). */
export const EXPENSE_CATEGORIES = {
  fuel: { label: "Combustível", icon: "⛽", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  maintenance: { label: "Manutenção", icon: "🔧", color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  repair: { label: "Reparação", icon: "🛠️", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  insurance: { label: "Seguro", icon: "🛡️", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  tax: { label: "Imposto", icon: "📋", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  inspection: { label: "Inspeção", icon: "✅", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  toll: { label: "Portagem", icon: "🛣️", color: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  parking: { label: "Estacionamento", icon: "🅿️", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300" },
  parts: { label: "Peças", icon: "⚙️", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300" },
  other: { label: "Outros", icon: "📝", color: "bg-muted text-muted-foreground" },
} as const;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

/** Categoria conhecida da despesa (o OCR pode gravar valores livres como "meals"). */
export function categoryInfo(expense: Pick<ExpenseRecord, "category" | "type">) {
  const key = (expense.category in EXPENSE_CATEGORIES ? expense.category : expense.type in EXPENSE_CATEGORIES ? expense.type : "other") as ExpenseCategory;
  return { key, ...EXPENSE_CATEGORIES[key] };
}

export type DateFilter = "all" | "thisMonth" | "lastMonth" | "thisYear";

export function filterExpenses(expenses: ExpenseRecord[], dateFilter: DateFilter, category: string): ExpenseRecord[] {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return expenses.filter((e) => {
    if (category !== "all" && categoryInfo(e).key !== category) return false;
    const d = new Date(e.date);
    const [y, m] = [d.getUTCFullYear(), d.getUTCMonth()];
    switch (dateFilter) {
      case "thisMonth": return y === now.getFullYear() && m === now.getMonth();
      case "lastMonth": return y === lastMonth.getFullYear() && m === lastMonth.getMonth();
      case "thisYear": return y === now.getFullYear();
      default: return true;
    }
  });
}

/** Totais por categoria e por mês (ordenados). */
export function expenseBreakdown(expenses: ExpenseRecord[]) {
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = new Map<ExpenseCategory, { total: number; count: number }>();
  const byMonth = new Map<string, number>();
  for (const e of expenses) {
    const { key } = categoryInfo(e);
    const c = byCategory.get(key) ?? { total: 0, count: 0 };
    c.total += Number(e.amount);
    c.count += 1;
    byCategory.set(key, c);
    const month = new Date(e.date).toISOString().slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + Number(e.amount));
  }
  return {
    total,
    categories: [...byCategory.entries()]
      .map(([key, c]) => ({ key, ...EXPENSE_CATEGORIES[key], ...c, percentage: total > 0 ? (c.total / total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total),
    months: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ month, total: value })),
  };
}

/** Descarrega as despesas em CSV (separador ";" e BOM UTF-8, para abrir no Excel em pt-PT). */
export function downloadExpensesCsv(expenses: ExpenseRecord[], fileName: string) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Data", "Categoria", "Descrição", "Fornecedor", "Valor (€)", "Km"],
    ...expenses.map((e) => [
      formatDate(e.date, ""),
      categoryInfo(e).label,
      e.description ?? "",
      e.vendor ?? "",
      Number(e.amount).toFixed(2).replace(".", ","),
      e.mileage ?? "",
    ]),
  ];
  const csv = "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
