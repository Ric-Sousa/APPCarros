import { Wrench } from "lucide-react";
import type { Alert, Vehicle } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import AlertActions from "./AlertActions";
import { ALERT_ICONS, ALERT_PRIORITY, alertDueText, sortAlerts } from "@/lib/alerts";

/** Topo do dashboard: os prazos mais urgentes (máx. 3), com ações rápidas. Não aparece se estiver tudo em dia. */
export default function AttentionCard({ alerts, vehicles }: { alerts: Alert[]; vehicles: Vehicle[] }) {
  const top = sortAlerts(alerts.filter((a) => !a.isDismissed)).slice(0, 3);
  if (top.length === 0) return null;

  return (
    <Card className="border-destructive/30">
      <CardContent className="p-4 sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold">Precisa de atenção</h2>
        <ul className="space-y-3">
          {top.map((alert) => {
            const [Icon, iconColor] = ALERT_ICONS[alert.type] ?? [Wrench, "text-muted-foreground"];
            const [label, color, bg] = ALERT_PRIORITY[alert.priority] ?? ALERT_PRIORITY.normal;
            const vehicle = vehicles.find((v) => v.id === alert.vehicleId);
            return (
              <li key={alert.id} className="rounded-lg border border-border p-3 space-y-3" data-testid={`attention-${alert.id}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${iconColor}`} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">{alert.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {alertDueText(alert)}
                      {vehicle && ` · ${vehicle.brand} ${vehicle.model}`}
                      <span className={`ml-2 text-xs font-medium ${color}`}>{label}</span>
                    </p>
                  </div>
                </div>
                <AlertActions alert={alert} />
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
