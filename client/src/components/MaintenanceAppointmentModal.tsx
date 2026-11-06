import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Vehicle } from "@shared/schema";
import { post } from "@/lib/apiUtils";

const appointmentSchema = z.object({
  serviceType: z.string().min(1, "Tipo de serviço é obrigatório"),
  scheduledDate: z.string().min(1, "Data é obrigatória"),
  scheduledTime: z.string().min(1, "Hora é obrigatória"),
  description: z.string().optional(),
  estimatedCost: z.string().optional(),
  workshopName: z.string().min(1, "Nome da oficina é obrigatório"),
  workshopAddress: z.string().optional(),
  workshopPhone: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface MaintenanceAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
}

export default function MaintenanceAppointmentModal({
  isOpen,
  onClose,
  vehicle,
}: MaintenanceAppointmentModalProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      serviceType: "",
      scheduledDate: "",
      scheduledTime: "",
      description: "",
      estimatedCost: "",
      workshopName: "",
      workshopAddress: "",
      workshopPhone: "",
    },
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: AppointmentFormData) => {
      if (!vehicle) throw new Error("Veículo não selecionado");

            const scheduledDateTime = new Date(`${data.scheduledDate}T${data.scheduledTime}`);

      // Field names follow the server schema (maintenance_appointments)
      return post(`/api/vehicles/${vehicle.id}/appointments`, {
        type: data.serviceType,
        title: `${data.serviceType} — ${data.workshopName}`,
        scheduledDate: scheduledDateTime.toISOString(),
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
      toast({
        title: "Sucesso!",
        description: "Agendamento criado com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", vehicle?.id, "appointments"] });
      reset();
      onClose();
    },
        onError: (error) => {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao criar agendamento. Tente novamente.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const onSubmit = (data: AppointmentFormData) => {
    setIsSubmitting(true);
    createAppointmentMutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const serviceTypes = [
    "Troca de óleo",
    "Revisão geral",
    "Troca de pneus",
    "Alinhamento e balanceamento",
    "Inspeção técnica",
    "Reparação de travões",
    "Substituição de filtros",
    "Reparação do motor",
    "Manutenção do ar condicionado",
    "Outros",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
  <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar Manutenção</DialogTitle>
          {vehicle && (
            <p className="text-sm text-muted-foreground">
              {vehicle.brand} {vehicle.model} ({vehicle.year}) - {vehicle.licensePlate}
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serviceType">Tipo de Serviço *</Label>
              <Select onValueChange={(value) => setValue("serviceType", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de serviço" />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.serviceType && (
                <p className="text-sm text-destructive">{errors.serviceType.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedCost">Custo Estimado (€)</Label>
              <Input
                id="estimatedCost"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("estimatedCost")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduledDate">Data *</Label>
              <Input
                id="scheduledDate"
                type="date"
                min={new Date().toISOString().split('T')[0]}
                {...register("scheduledDate")}
              />
              {errors.scheduledDate && (
                <p className="text-sm text-destructive">{errors.scheduledDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledTime">Hora *</Label>
              <Input
                id="scheduledTime"
                type="time"
                {...register("scheduledTime")}
              />
              {errors.scheduledTime && (
                <p className="text-sm text-destructive">{errors.scheduledTime.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workshopName">Nome da Oficina *</Label>
            <Input
              id="workshopName"
              placeholder="Nome da oficina"
              {...register("workshopName")}
            />
            {errors.workshopName && (
              <p className="text-sm text-destructive">{errors.workshopName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="workshopAddress">Morada da Oficina</Label>
            <Input
              id="workshopAddress"
              placeholder="Morada da oficina"
              {...register("workshopAddress")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workshopPhone">Telefone da Oficina</Label>
            <Input
              id="workshopPhone"
              placeholder="Telefone da oficina"
              {...register("workshopPhone")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição/Observações</Label>
            <Textarea
              id="description"
              placeholder="Descreva os detalhes da manutenção..."
              rows={3}
              {...register("description")}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Agendando..." : "Agendar Manutenção"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}