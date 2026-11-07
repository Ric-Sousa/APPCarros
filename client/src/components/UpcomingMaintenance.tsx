import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CircleDot, ClipboardCheck, Droplet, Euro, Shield, Wrench, type LucideIcon } from "lucide-react";
import type { Alert, Vehicle } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import MaintenanceAppointmentModal from "./MaintenanceAppointmentModal";
import AppointmentsList from "./AppointmentsList";
import { useVehicles } from "@/hooks/useVehicles";
import { useToast } from "@/hooks/use-toast";
import { patch, handleApiError } from "@/lib/apiUtils";
import { daysUntil, formatNumber } from "@/lib/utils";

const ALERT_ICONS: Record<string, [LucideIcon, string]> = {
  oil_change: [Droplet, "text-destructive"],
  tire_change: [CircleDot, "text-secondary"],
  inspection: [ClipboardCheck, "text-accent"],
  iuc: [Euro, "text-primary"],
  insurance: [Shield, "text-primary"],
};

const PRIORITY: Record<string, [string, string, string]> = {
  urgent: ["Urgente", "text-destructive", "bg-destructive/20"],
  high: ["Alta", "text-orange-600 dark:text-orange-400", "bg-orange-500/20"],
  normal: ["Normal", "text-muted-foreground", "bg-primary/20"],
};

function dueText(alert: Alert): string {
  const days = daysUntil(alert.dueDate);
  if (days !== null) {
    if (days < 0) return `Venceu há ${-days} ${days === -1 ? "dia" : "dias"}`;
    if (days === 0) return "Vence hoje";
    if (days === 1) return "Amanhã";
    return `Em ${days} dias`;
  }
  return alert.dueMileage ? `Aos ${formatNumber(alert.dueMileage)} km` : "Sem data definida";
}

/** Alertas gerados a partir dos dados dos veículos + marcações agendadas. */
export default function UpcomingMaintenance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const { data: vehicles = [] } = useVehicles();
  const { data: alerts = [], isLoading } = useQuery<Alert[]>({ queryKey: ["/api/alerts"] });
  const visible = alerts.filter((a) => !a.isDismissed).slice(0, 5);

  const dismiss = useMutation({
    mutationFn: (id: string) => patch(`/api/alerts/${encodeURIComponent(id)}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => toast({ title: "Erro", description: handleApiError(error), variant: "destructive" }),
  });

  return (
    <>
      <Card className="rounded-xl border border-border">
        <CardContent className="p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-lg font-semibold">Próximas Manutenções</h3>
            {vehicles.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                <Label htmlFor="upcoming-vehicle-select" className="text-sm font-medium sr-only sm:not-sr-only">Veículo:</Label>
                <div className="flex gap-2 min-w-0">
                  <Select onValueChange={(id) => setSelectedVehicle(vehicles.find((v) => v.id === id) ?? null)} value={selectedVehicle?.id}>
                    <SelectTrigger id="upcoming-vehicle-select" className="w-full sm:w-[200px] min-w-0">
                      <SelectValue placeholder="Selecione um veículo" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} ({v.licensePlate})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" data-testid="button-schedule-maintenance" onClick={() => setIsModalOpen(true)} disabled={!selectedVehicle} className="shrink-0">
                    Agendar
                  </Button>
                </div>
              </div>
            )}
          </div>

          <section aria-label="Alertas" className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground" role="status">A carregar alertas...</p>
            ) : visible.length === 0 ? (
              <div className="text-center py-4">
                <CalendarCheck className="w-6 h-6 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
                <p className="text-muted-foreground text-sm">Sem prazos próximos. Tudo em dia!</p>
              </div>
            ) : (
              visible.map((alert) => {
                const [Icon, iconColor] = ALERT_ICONS[alert.type] ?? [Wrench, "text-muted-foreground"];
                const [label, color, bg] = PRIORITY[alert.priority] ?? PRIORITY.normal;
                const vehicle = vehicles.find((v) => v.id === alert.vehicleId);
                return (
                  <div key={alert.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors" data-testid={`maintenance-alert-${alert.id}`}>
                    <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center shrink-0`}>
                      <Icon className={`w-5 h-5 ${iconColor}`} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium break-words">{alert.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {dueText(alert)}
                        {vehicle && ` · ${vehicle.brand} ${vehicle.model}`}
                      </p>
                      <p className={`text-xs font-medium ${color}`}>{label}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-primary shrink-0" onClick={() => dismiss.mutate(alert.id)} disabled={dismiss.isPending} data-testid={`button-complete-alert-${alert.id}`}>
                      Concluir
                    </Button>
                  </div>
                );
              })
            )}
          </section>

          <section aria-labelledby="appointments-heading" className="space-y-3">
            <h4 id="appointments-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Marcações</h4>
            <AppointmentsList vehicles={vehicles} limit={5} />
          </section>
        </CardContent>
      </Card>

      <MaintenanceAppointmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} vehicle={selectedVehicle} />
    </>
  );
}
