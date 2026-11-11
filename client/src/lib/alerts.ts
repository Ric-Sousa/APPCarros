import { CircleDot, ClipboardCheck, Droplet, Euro, Shield, type LucideIcon } from "lucide-react";
import type { Alert } from "@shared/schema";
import { daysUntil, formatNumber } from "@/lib/utils";

export const ALERT_ICONS: Record<string, [LucideIcon, string]> = {
  oil_change: [Droplet, "text-destructive"],
  tire_change: [CircleDot, "text-secondary"],
  inspection: [ClipboardCheck, "text-accent"],
  iuc: [Euro, "text-primary"],
  insurance: [Shield, "text-primary"],
};

export const ALERT_PRIORITY: Record<string, [string, string, string]> = {
  urgent: ["Urgente", "text-destructive", "bg-destructive/20"],
  high: ["Alta", "text-orange-600 dark:text-orange-400", "bg-orange-500/20"],
  normal: ["Normal", "text-muted-foreground", "bg-primary/20"],
};

const ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2 };

/** Mais urgentes primeiro; depois os que vencem mais cedo. */
export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort(
    (a, b) => (ORDER[a.priority] ?? 3) - (ORDER[b.priority] ?? 3) || (daysUntil(a.dueDate) ?? 9999) - (daysUntil(b.dueDate) ?? 9999),
  );
}

export function alertDueText(alert: Alert): string {
  const days = daysUntil(alert.dueDate);
  if (days !== null) {
    if (days < 0) return `Venceu há ${-days} ${days === -1 ? "dia" : "dias"}`;
    if (days === 0) return "Vence hoje";
    if (days === 1) return "Amanhã";
    return `Em ${days} dias`;
  }
  return alert.dueMileage ? `Aos ${formatNumber(alert.dueMileage)} km` : "Sem data definida";
}
