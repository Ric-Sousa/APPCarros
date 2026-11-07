import { useQuery } from "@tanstack/react-query";
import { Droplet, CircleDot, ClipboardCheck, Wrench, Settings, Clock, type LucideIcon } from "lucide-react";
import type { MaintenanceRecord } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { useVehicles } from "@/hooks/useVehicles";
import { daysUntil, formatEuro } from "@/lib/utils";

const ACTIVITY_ICONS: Record<string, [LucideIcon, string]> = {
  oil_change: [Droplet, "text-secondary"],
  tire_change: [CircleDot, "text-primary"],
  inspection: [ClipboardCheck, "text-accent"],
  repair: [Wrench, "text-destructive"],
};

function relative(date: string | Date): string {
  const days = -(daysUntil(date) ?? 0);
  if (days <= 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 7) return `Há ${days} dias`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? "Há 1 semana" : `Há ${weeks} semanas`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "Há 1 mês" : `Há ${months} meses`;
}

/** Últimas manutenções de todos os veículos (uma só consulta). */
export default function RecentActivity() {
  const { data: vehicles = [] } = useVehicles();
  const { data: records = [], isLoading } = useQuery<MaintenanceRecord[]>({ queryKey: ["/api/maintenance?limit=5"] });

  return (
    <Card className="rounded-xl border border-border">
      <CardContent className="p-4 sm:p-6">
        <h3 className="text-lg font-semibold mb-6">Atividade Recente</h3>
        <div className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground" role="status">A carregar...</p>
          ) : records.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
              <p className="text-muted-foreground">Nenhuma atividade recente</p>
            </div>
          ) : (
            records.map((record) => {
              const [Icon, color] = ACTIVITY_ICONS[record.type] ?? [Settings, "text-muted-foreground"];
              const vehicle = vehicles.find((v) => v.id === record.vehicleId);
              return (
                <div key={record.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors" data-testid={`activity-${record.id}`}>
                  <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center shrink-0">
                    <Icon className={`w-5 h-5 ${color}`} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm break-words">
                      {record.description}
                      {vehicle && ` — ${vehicle.brand} ${vehicle.model}`}
                    </p>
                    <p className="text-xs text-muted-foreground">{relative(record.performedAt)}</p>
                  </div>
                  {Number(record.cost) > 0 && <p className="text-xs text-muted-foreground shrink-0">{formatEuro(record.cost)}</p>}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
