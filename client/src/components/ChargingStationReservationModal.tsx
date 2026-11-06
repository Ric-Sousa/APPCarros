import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { post } from "@/lib/apiUtils";

const reservationSchema = z.object({
  reservationDate: z.string().min(1, "Data é obrigatória"),
  reservationTime: z.string().min(1, "Hora é obrigatória"),
  duration: z.string().min(1, "Duração é obrigatória"),
  notes: z.string().optional(),
});

type ReservationFormData = z.infer<typeof reservationSchema>;

interface ChargingStation {
  id: string;
  name: string;
  address: string;
    power: number;
  price: number | null;
  network: string;
}

interface ChargingStationReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  station: ChargingStation | null;
}

export default function ChargingStationReservationModal({
  isOpen,
  onClose,
  vehicleId,
  station,
}: ChargingStationReservationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ReservationFormData>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      reservationDate: "",
      reservationTime: "",
      duration: "60", // Default 1 hour
      notes: "",
    },
  });

  const createReservationMutation = useMutation({
    mutationFn: async (data: ReservationFormData) => {
      if (!station) throw new Error("Posto não selecionado");
      
            const reservationDateTime = new Date(`${data.reservationDate}T${data.reservationTime}`);
      const minutes = parseInt(data.duration);
      const endDateTime = new Date(reservationDateTime.getTime() + minutes * 60000);
      const hhmm = (d: Date) => d.toTimeString().slice(0, 5);
      const chargingType = station.power >= 50 ? "fast" : station.power >= 11 ? "normal" : "slow";

      // Field names follow the server schema (charging_station_reservations); vehicleId/userId come from the URL/token
      const payload = {
        stationId: String(station.id),
        stationName: station.name,
        stationAddress: station.address || station.name,
        reservationDate: reservationDateTime.toISOString(),
        startTime: hhmm(reservationDateTime),
        endTime: hhmm(endDateTime),
        estimatedChargingTime: minutes,
        chargingType,
                // ponytail: estimate assumes a 50 kWh charge at the station price; no price → no estimate

                estimatedCost: station.price ? (station.price * 50).toFixed(2) : undefined,
        notes: data.notes || undefined,
      };

      return post(`/api/vehicles/${vehicleId}/reservations`, payload);
    },
    onSuccess: () => {
      toast({
        title: "Reserva criada com sucesso!",
                description: `A sua reserva em ${station?.name} foi agendada.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", vehicleId, "reservations"] });
      reset();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar reserva",
        description: error.message || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ReservationFormData) => {
    createReservationMutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];
  
  // Get minimum time (current time if today is selected)
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
  <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reservar Posto de Carregamento</DialogTitle>
          {station && (
            <div className="text-sm text-muted-foreground mt-2">
              <p><strong>{station.name}</strong></p>
              <p>{station.address}</p>
              <p>{station.power}kW • {station.network}{station.price != null && <> • €{station.price}/kWh</>}</p>
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reservationDate">Data *</Label>
              <Input
                id="reservationDate"
                type="date"
                min={today}
                {...register("reservationDate")}
              />
              {errors.reservationDate && (
                <p className="text-sm text-destructive">{errors.reservationDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reservationTime">Hora *</Label>
              <Input
                id="reservationTime"
                type="time"
                {...register("reservationTime")}
              />
              {errors.reservationTime && (
                <p className="text-sm text-destructive">{errors.reservationTime.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duração (minutos) *</Label>
            <select
              id="duration"
              {...register("duration")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="30">30 minutos</option>
              <option value="60">1 hora</option>
              <option value="90">1h 30min</option>
              <option value="120">2 horas</option>
              <option value="180">3 horas</option>
              <option value="240">4 horas</option>
            </select>
            {errors.duration && (
              <p className="text-sm text-destructive">{errors.duration.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Observações adicionais (opcional)"
              {...register("notes")}
            />
          </div>

                    {station && station.price != null && (
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">Estimativa de Custo:</p>
              <p className="text-sm text-muted-foreground">
                Baseado em 50kWh de carregamento
              </p>
              <p className="text-lg font-bold text-primary">
                €{(station.price * 50).toFixed(2)}
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createReservationMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createReservationMutation.isPending || !station}
            >
              {createReservationMutation.isPending ? "Reservando..." : "Reservar Posto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}