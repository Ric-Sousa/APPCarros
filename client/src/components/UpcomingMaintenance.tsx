import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Alert, Vehicle } from "@shared/schema";
import MaintenanceAppointmentModal from "./MaintenanceAppointmentModal";
import { useVehicles } from "@/hooks/useVehicles";
import { patch } from "@/lib/apiUtils";
import { queryClient } from "@/lib/queryClient";
import { Droplet, CircleDot, ClipboardCheck, Euro, Shield, Wrench, CalendarCheck, type LucideIcon } from "lucide-react";

const ALERT_ICONS: Record<string, [LucideIcon, string]> = {
  oil_change: [Droplet, 'text-destructive'],
  tire_change: [CircleDot, 'text-secondary'],
  inspection: [ClipboardCheck, 'text-accent'],
  iuc: [Euro, 'text-primary'],
  insurance: [Shield, 'text-primary'],
};

export default function UpcomingMaintenance() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    select: (data) => data.filter((alert: Alert) => !alert.isDismissed).slice(0, 5),
  });

  const { data: vehicles = [] } = useVehicles();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-destructive';
      case 'normal': return 'text-muted-foreground';
      case 'low': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  const getPriorityBg = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive/20';
      case 'normal': return 'bg-primary/20';
      case 'low': return 'bg-secondary/20';
      default: return 'bg-muted/20';
    }
  };

  const formatDueInfo = (alert: Alert) => {
    if (alert.dueDate) {
      const now = new Date();
      const dueDate = new Date(alert.dueDate);
      const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 0) return 'Vencido';
      if (daysDiff === 1) return 'Amanhã';
      if (daysDiff < 7) return `Em ${daysDiff} dias`;
      if (daysDiff < 30) return `Em ${Math.floor(daysDiff / 7)} semanas`;
      return `Em ${Math.floor(daysDiff / 30)} meses`;
    }
    
    if (alert.dueMileage) {
      return `${alert.dueMileage.toLocaleString()} km`;
    }
    
    return 'Data não definida';
  };

  return (
    <>
      <Card className="rounded-xl border border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Próximas Manutenções</h3>
            <div className="flex items-center space-x-2">
              {vehicles.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Label htmlFor="vehicle-select" className="text-sm font-medium">
                    Veículo:
                  </Label>
                  <Select onValueChange={(vehicleId) => {
                    const vehicle = vehicles.find(v => v.id === vehicleId);
                    setSelectedVehicle(vehicle || null);
                  }}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Selecione um veículo" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.brand} {vehicle.model} ({vehicle.licensePlate})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button 
                size="sm"
                data-testid="button-schedule-maintenance"
                onClick={() => {
                  if (!selectedVehicle) {
                    alert('Por favor, selecione um veículo primeiro.');
                    return;
                  }
                  setIsModalOpen(true);
                }}
                disabled={!selectedVehicle}
              >
                Agendar
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 rounded-lg border border-border">
                  <div className="w-12 h-12 bg-muted rounded-lg animate-pulse"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded animate-pulse mb-2"></div>
                    <div className="h-3 bg-muted rounded animate-pulse w-1/2 mb-1"></div>
                    <div className="h-3 bg-muted rounded animate-pulse w-1/3"></div>
                  </div>
                  <div className="w-16 h-8 bg-muted rounded animate-pulse"></div>
                </div>
              ))
            ) : alerts.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarCheck className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="text-muted-foreground">Nenhuma manutenção agendada</p>
              </div>
            ) : (
              alerts.map((alert: Alert) => (
                <div 
                  key={alert.id} 
                  className="flex items-center space-x-4 p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                  data-testid={`maintenance-alert-${alert.id}`}
                >
                  <div className={`w-12 h-12 ${getPriorityBg(alert.priority)} rounded-lg flex items-center justify-center`}>
                    {(() => {
                      const [Icon, color] = ALERT_ICONS[alert.type] ?? [Wrench, 'text-muted-foreground'];
                      return <Icon className={`w-5 h-5 ${color}`} aria-hidden="true" />;
                    })()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground" data-testid={`text-alert-title-${alert.id}`}>
                      {alert.title}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid={`text-alert-due-${alert.id}`}>
                      {formatDueInfo(alert)}
                    </p>
                    <p className={`text-xs font-medium ${getPriorityColor(alert.priority)}`} data-testid={`text-alert-priority-${alert.id}`}>
                      {alert.priority === 'urgent' ? 'Urgente' : 
                       alert.priority === 'normal' ? 'Normal' : 'Baixa'}
                    </p>
                  </div>
                  <div className="text-right">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="text-primary hover:text-primary/80"
                      data-testid={`button-complete-alert-${alert.id}`}
                                            onClick={async () => {
                        await patch(`/api/alerts/${alert.id}/dismiss`).catch(() => {});
                        queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
                      }}
                    >
                      Concluir
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      
      <MaintenanceAppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        vehicle={selectedVehicle}
      />
    </>
  );
}
