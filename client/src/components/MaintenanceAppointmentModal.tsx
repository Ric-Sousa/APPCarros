import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Vehicle } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { post, handleApiError } from "@/lib/apiUtils";
import { localDateInput } from "@/lib/utils";
import { MAINTENANCE_TYPES, MAINTENANCE_KEYS, maintenanceLabel } from "@/lib/maintenance";

const appointmentSchema = z.object({
  type: z.string().min(1, "Tipo de serviço é obrigatório"),
  scheduledDate: z.string().min(1, "Data é obrigatória"),
  scheduledTime: z.string().min(1, "Hora é obrigatória"),
  description: z.string().optional(),
  estimatedCost: z.string().optional(),
  workshopName: z.string().trim().min(1, "Nome da oficina é obrigatório"),
  workshopAddress: z.string().optional(),
  workshopPhone: z.string().optional(),
});
type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface MaintenanceAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
}

export default function MaintenanceAppointmentModal({ isOpen, onClose, vehicle }: MaintenanceAppointmentModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: { type: "", scheduledDate: "", scheduledTime: "", description: "", estimatedCost: "", workshopName: "", workshopAddress: "", workshopPhone: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: AppointmentFormData) => {
      if (!vehicle) throw new Error("Veículo não selecionado");
      // Nomes dos campos do esquema do servidor (maintenance_appointments)
      return post(`/api/vehicles/${vehicle.id}/appointments`, {
        type: data.type,
        title: `${maintenanceLabel(data.type)} — ${data.workshopName}`,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        description: data.description || undefined,
        estimatedCost: data.estimatedCost || undefined,
        serviceProvider: data.workshopName,
        serviceLocation: data.workshopAddress || undefined,
        notes: data.workshopPhone ? `Telefone: ${data.workshopPhone}` : undefined,
        mileageAtAppointment: vehicle.currentMileage,
        status: "scheduled",
      });
    },
    onSuccess: () => {
      toast({ title: "Manutenção agendada", description: "A marcação foi guardada. Confirme a hora com a oficina." });
      MAINTENANCE_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", vehicle?.id, "appointments"] });
      reset();
      onClose();
    },
    onError: (error) => toast({ title: "Erro", description: handleApiError(error, "Erro ao criar a marcação."), variant: "destructive" }),
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const fieldError = (msg?: string) => msg && <p className="text-sm text-destructive">{msg}</p>;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar Manutenção</DialogTitle>
          <DialogDescription>
            {vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.year}) — ${vehicle.licensePlate}` : "Escolha a data e a oficina."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appointment-type">Tipo de Serviço *</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <SelectTrigger id="appointment-type">
                      <SelectValue placeholder="Selecione o tipo de serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {MAINTENANCE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {fieldError(errors.type?.message)}
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimatedCost">Custo Estimado (€)</Label>
              <Input id="estimatedCost" type="number" step="0.01" min="0" placeholder="0,00" {...register("estimatedCost")} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduledDate">Data *</Label>
              <Input id="scheduledDate" type="date" min={localDateInput()} {...register("scheduledDate")} />
              {fieldError(errors.scheduledDate?.message)}
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledTime">Hora *</Label>
              <Input id="scheduledTime" type="time" {...register("scheduledTime")} />
              {fieldError(errors.scheduledTime?.message)}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workshopName">Nome da Oficina *</Label>
            <Input id="workshopName" placeholder="Nome da oficina" {...register("workshopName")} />
            {fieldError(errors.workshopName?.message)}
          </div>
          <div className="space-y-2">
            <Label htmlFor="workshopAddress">Morada da Oficina</Label>
            <Input id="workshopAddress" placeholder="Morada da oficina" {...register("workshopAddress")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workshopPhone">Telefone da Oficina</Label>
            <Input id="workshopPhone" type="tel" placeholder="Telefone da oficina" {...register("workshopPhone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="appointment-description">Descrição/Observações</Label>
            <Textarea id="appointment-description" placeholder="Detalhes da manutenção..." rows={3} {...register("description")} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "A agendar..." : "Agendar Manutenção"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
