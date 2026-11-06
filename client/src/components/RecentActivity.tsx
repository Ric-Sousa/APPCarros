import { useQuery } from "@tanstack/react-query";
import { Droplet, CircleDot, ClipboardCheck, Wrench, Settings, Clock, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { get } from '@/lib/apiUtils';
import { useVehicles } from "@/hooks/useVehicles";
import type { MaintenanceRecord } from "@shared/schema";

const ACTIVITY_ICONS: Record<string, [LucideIcon, string]> = {
  oil_change: [Droplet, 'text-secondary'],
  tire_change: [CircleDot, 'text-primary'],
  inspection: [ClipboardCheck, 'text-accent'],
  repair: [Wrench, 'text-destructive'],
};

export default function RecentActivity() {
  const { data: vehicles = [] } = useVehicles();
  const vehicleIds = vehicles.map((v) => v.id);

  // 5 most recent maintenance records across all vehicles (fetched in parallel)
  const { data: allRecords = [], isLoading } = useQuery({
    queryKey: ["/api/vehicles", "recent-maintenance", ...vehicleIds],
    queryFn: async () => {
      const perVehicle = await Promise.all(
        vehicles.map((vehicle) =>
          get<MaintenanceRecord[]>(`/api/vehicles/${vehicle.id}/maintenance`)
            .then((records) => records.map((r) => ({ ...r, vehicleName: `${vehicle.brand} ${vehicle.model}` })))
            .catch(() => []),
        ),
      );
      return perVehicle
        .flat()
        .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())
        .slice(0, 5);
    },
    enabled: vehicles.length > 0,
  });

  const getRelativeTime = (date: string) => {
    const now = new Date();
    const activityDate = new Date(date);
    const diffInHours = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return `Há ${diffInHours} horas`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays === 1) return 'Há 1 dia';
      if (diffInDays < 7) return `Há ${diffInDays} dias`;
      const diffInWeeks = Math.floor(diffInDays / 7);
      if (diffInWeeks === 1) return 'Há 1 semana';
      return `Há ${diffInWeeks} semanas`;
    }
  };

  return (
    <Card className="rounded-xl border border-border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Atividade Recente</h3>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-3 rounded-lg bg-muted/30">
                <div className="w-10 h-10 bg-muted rounded-lg animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded animate-pulse mb-1"></div>
                  <div className="h-3 bg-muted rounded animate-pulse w-2/3"></div>
                </div>
                <div className="w-16 h-4 bg-muted rounded animate-pulse"></div>
              </div>
            ))
          ) : allRecords.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-muted-foreground">Nenhuma atividade recente</p>
            </div>
          ) : (
            allRecords.map((record: any) => (
              <div 
                key={record.id} 
                className="flex items-center space-x-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                data-testid={`activity-${record.id}`}
              >
                <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center">
                  {(() => {
                    const [Icon, color] = ACTIVITY_ICONS[record.type] ?? [Settings, 'text-muted-foreground'];
                    return <Icon className={`w-5 h-5 ${color}`} aria-hidden="true" />;
                  })()}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm" data-testid={`text-activity-description-${record.id}`}>
                    {record.description} - {record.vehicleName}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid={`text-activity-date-${record.id}`}>
                    {getRelativeTime(record.performedAt)}
                  </p>
                </div>
                {record.cost && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground" data-testid={`text-activity-cost-${record.id}`}>
                      €{parseFloat(record.cost).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
