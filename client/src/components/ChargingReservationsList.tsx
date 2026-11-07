import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BatteryCharging, X } from "lucide-react";
import type { ChargingStationReservation } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { put, handleApiError } from "@/lib/apiUtils";
import { formatDate } from "@/lib/utils";

/** Carregamentos planeados de um veículo (lembretes), com opção de cancelar. */
export default function ChargingReservationsList({ vehicleId }: { vehicleId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery<ChargingStationReservation[]>({ queryKey: ["/api/vehicles", vehicleId, "reservations"] });

  const cancel = useMutation({
    mutationFn: (id: string) => put(`/api/reservations/${id}`, { status: "cancelled" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", vehicleId, "reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      toast({ title: "Carregamento cancelado" });
    },
    onError: (error) => toast({ title: "Erro", description: handleApiError(error), variant: "destructive" }),
  });

  const upcoming = data.filter((r) => r.status !== "cancelled" && r.status !== "completed");
  if (isLoading) return <p className="text-sm text-muted-foreground" role="status">A carregar...</p>;
  if (upcoming.length === 0) return <p className="text-sm text-muted-foreground">Sem carregamentos planeados.</p>;

  return (
    <ul className="space-y-3">
      {upcoming.map((r) => (
        <li key={r.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
          <BatteryCharging className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm break-words">{r.stationName}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(r.reservationDate)} · {r.startTime}–{r.endTime}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => cancel.mutate(r.id)} disabled={cancel.isPending} aria-label={`Cancelar carregamento em ${r.stationName}`}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
