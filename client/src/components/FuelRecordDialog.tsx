import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FuelRecord, Vehicle } from '@shared/schema';
import { normalizeFuelType } from '@shared/fuel';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Form } from './ui/form';
import { Button } from './ui/button';
import FuelRecordFields from './FuelRecordFields';
import { useToast } from '@/hooks/use-toast';
import { post, put, handleApiError } from '@/lib/apiUtils';
import { localDateInput, toDateInput } from '@/lib/utils';
import { fuelFormSchema, FUEL_KEYS, type FuelFormData } from '@/lib/fuelForm';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Registo a editar; sem ele, cria um novo. */
  record?: FuelRecord | null;
  /** Veículo fixo; sem ele, aparece a escolha de veículo (usa `vehicles`). */
  vehicle?: Vehicle;
  vehicles?: Vehicle[];
}

const emptyValues = (vehicle?: Vehicle): FuelFormData => ({
  vehicleId: vehicle?.id ?? '',
  date: localDateInput(),
  mileage: vehicle?.currentMileage ?? 0,
  liters: 0,
  costPerLiter: 1.65,
  totalCost: 0,
  fuelType: normalizeFuelType(vehicle?.fuelType) ?? 'gasoline95',
  gasStationName: '',
  gasStationLocation: '',
  fullTank: true,
  notes: '',
});

const toValues = (r: FuelRecord): FuelFormData => ({
  vehicleId: r.vehicleId,
  date: toDateInput(r.date),
  mileage: r.mileage,
  liters: Number(r.liters),
  costPerLiter: Number(r.costPerLiter),
  totalCost: Number(r.totalCost),
  fuelType: normalizeFuelType(r.fuelType) ?? r.fuelType,
  gasStationName: r.gasStationName ?? '',
  gasStationLocation: r.gasStationLocation ?? '',
  fullTank: r.fullTank,
  notes: r.notes ?? '',
});

/** Criar ou editar um abastecimento (um só formulário para toda a aplicação). */
export default function FuelRecordDialog({ open, onOpenChange, record, vehicle, vehicles }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<FuelFormData>({ resolver: zodResolver(fuelFormSchema), defaultValues: emptyValues(vehicle) });

  // Valores iniciais só quando o diálogo abre (editar não recalcula nada)
  useEffect(() => {
    if (open) form.reset(record ? toValues(record) : emptyValues(vehicle));
  }, [open, record, vehicle, form]);

  const mutation = useMutation({
    mutationFn: ({ vehicleId, ...data }: FuelFormData) =>
      record ? put(`/api/fuel-records/${record.id}`, data) : post('/api/fuel-records', { ...data, vehicleId }),
    onSuccess: () => {
      FUEL_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      toast({ title: record ? 'Registo atualizado' : 'Abastecimento registado' });
      onOpenChange(false);
    },
    onError: (error) => toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? 'Editar Abastecimento' : 'Registar Abastecimento'}</DialogTitle>
          <DialogDescription>
            {vehicle ? `${vehicle.brand} ${vehicle.model} — ${vehicle.licensePlate}` : 'Indique o veículo e os dados do abastecimento.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FuelRecordFields form={form} vehicles={vehicle || record ? undefined : vehicles} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'A guardar...' : 'Guardar'}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
