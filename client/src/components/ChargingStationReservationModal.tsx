import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { post, handleApiError } from "@/lib/apiUtils";
import { localDateInput } from "@/lib/utils";
import type { ChargingStation } from "@/components/ElectricVehicleHub";

const reservationSchema = z.object({
  reservationDate: z.string().min(1, "Data é obrigatória"),
  reservationTime: z.string().min(1, "Hora é obrigatória"),
  duration: z.string().min(1, "Duração é obrigatória"),
  notes: z.string().optional(),
});
type ReservationFormData = z.infer<typeof reservationSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  station: ChargingStation | null;
}

/** Registo de um carregamento planeado (lembrete na app; o operador do posto não é contactado). */
export default function ChargingStationReservationModal({ isOpen, onClose, vehicleId, station }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<ReservationFormData>({
    resolver: zodResolver(reservationSchema),
    defaultValues: { reservationDate: "", reservationTime: "", duration: "60", notes: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: ReservationFormData) => {
      if (!station) throw new Error("Posto não selecionado");
      const start = new Date(`${data.reservationDate}T${data.reservationTime}`);
      const minutes = parseInt(data.duration, 10);
      const end = new Date(start.getTime() + minutes * 60000);
      const hhmm = (d: Date) => d.toTimeString().slice(0, 5);
      // Nomes dos campos do esquema do servidor (charging_station_reservations)
      return post(`/api/vehicles/${vehicleId}/reservations`, {
        stationId: String(station.id),
        stationName: station.name,
        stationAddress: station.address || station.name,
        reservationDate: data.reservationDate,
        startTime: hhmm(start),
        endTime: hhmm(end),
        estimatedChargingTime: minutes,
        chargingType: station.power >= 50 ? "fast" : station.power >= 11 ? "normal" : "slow",
        notes: data.notes || undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Carregamento registado",
        description: `Fica como lembrete na app. A reserva junto de ${station?.name ?? "o posto"} tem de ser feita na app ou site do operador.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", vehicleId, "reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      reset();
      onClose();
    },
    onError: (error) => toast({ title: "Erro ao registar", description: handleApiError(error), variant: "destructive" }),
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Planear Carregamento</DialogTitle>
          <DialogDescription>
            {station ? `${station.name} — ${station.address} · ${station.power} kW · ${station.network}` : "Escolha a data e a hora."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            Este registo é um lembrete na LogiCar. Não reserva o posto junto do operador.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reservationDate">Data *</Label>
              <Input id="reservationDate" type="date" min={localDateInput()} {...register("reservationDate")} />
              {errors.reservationDate && <p className="text-sm text-destructive">{errors.reservationDate.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reservationTime">Hora *</Label>
              <Input id="reservationTime" type="time" {...register("reservationTime")} />
              {errors.reservationTime && <p className="text-sm text-destructive">{errors.reservationTime.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duração *</Label>
            <select
              id="duration"
              {...register("duration")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="30">30 minutos</option>
              <option value="60">1 hora</option>
              <option value="90">1 h 30 min</option>
              <option value="120">2 horas</option>
              <option value="180">3 horas</option>
              <option value="240">4 horas</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reservation-notes">Observações</Label>
            <Textarea id="reservation-notes" placeholder="Observações adicionais (opcional)" {...register("notes")} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={mutation.isPending}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending || !station}>{mutation.isPending ? "A registar..." : "Registar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
