import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, X } from "lucide-react";
import type { MaintenanceAppointment, Vehicle } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { put, handleApiError } from "@/lib/apiUtils";
import { formatDate, formatEuro } from "@/lib/utils";
import { maintenanceLabel, MAINTENANCE_KEYS } from "@/lib/maintenance";

interface Props {
  /** Só as marcações deste veículo; sem ele, todas as do utilizador. */
  vehicleId?: string;
  vehicles?: Vehicle[];
  limit?: number;
}

/** Marcações de manutenção por realizar, com ações para concluir ou cancelar. */
export default function AppointmentsList({ vehicleId, vehicles = [], limit }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = vehicleId ? ["/api/vehicles", vehicleId, "appointments"] : ["/api/appointments"];
  const { data = [], isLoading } = useQuery<MaintenanceAppointment[]>({ queryKey });

  const upcoming = data
    .filter((a) => a.status !== "completed" && a.status !== "cancelled")
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
    .slice(0, limit);

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "completed" | "cancelled" }) => put(`/api/appointments/${id}`, { status }),
    onSuccess: (_r, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      MAINTENANCE_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      toast({ title: status === "completed" ? "Marcação concluída" : "Marcação cancelada" });
    },
    onError: (error) => toast({ title: "Erro", description: handleApiError(error), variant: "destructive" }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground" role="status">A carregar marcações...</p>;
  if (upcoming.length === 0) return <p className="text-sm text-muted-foreground">Sem marcações agendadas.</p>;

  return (
    <ul className="space-y-3">
      {upcoming.map((a) => {
        const vehicle = vehicles.find((v) => v.id === a.vehicleId);
        return (
          <li key={a.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-border p-3" data-testid={`appointment-${a.id}`}>
            <CalendarClock className="hidden sm:block h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-sm break-words">{a.title}</p>
                <Badge variant="outline" className="text-xs">{maintenanceLabel(a.type)}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(a.scheduledDate)} às {a.scheduledTime}
                {vehicle && ` · ${vehicle.brand} ${vehicle.model}`}
                {a.serviceProvider && ` · ${a.serviceProvider}`}
                {a.estimatedCost && Number(a.estimatedCost) > 0 && ` · ${formatEuro(a.estimatedCost)}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => update.mutate({ id: a.id, status: "completed" })} disabled={update.isPending}>
                <Check className="h-4 w-4 mr-1" aria-hidden="true" /> Concluir
              </Button>
              <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: a.id, status: "cancelled" })} disabled={update.isPending}>
                <X className="h-4 w-4 mr-1" aria-hidden="true" /> Cancelar
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
