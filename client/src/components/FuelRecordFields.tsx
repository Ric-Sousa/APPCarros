import type { UseFormReturn } from 'react-hook-form';
import type { Vehicle } from '@shared/schema';
import { FUEL_TYPES } from '@shared/fuel';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import type { FuelFormData } from '@/lib/fuelForm';

/**
 * Campos do formulário de abastecimento. O total é recalculado só quando o utilizador muda
 * litros ou preço (nunca ao abrir uma edição), e pode ser corrigido à mão.
 */
export default function FuelRecordFields({ form, vehicles }: { form: UseFormReturn<FuelFormData>; vehicles?: Vehicle[] }) {
  const recalcTotal = (liters: number, price: number) => {
    if (liters > 0 && price > 0) form.setValue('totalCost', Number((liters * price).toFixed(2)), { shouldValidate: true });
  };

  return (
    <>
      {vehicles && (
        <FormField
          control={form.control}
          name="vehicleId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Veículo</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar veículo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} — {v.licensePlate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="mileage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quilómetros</FormLabel>
              <FormControl><Input type="number" min="0" inputMode="numeric" placeholder="120000" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="liters"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Litros</FormLabel>
              <FormControl>
                <Input
                  type="number" step="0.01" min="0" inputMode="decimal" placeholder="45,5" {...field}
                  onChange={(e) => { field.onChange(e); recalcTotal(Number(e.target.value), Number(form.getValues('costPerLiter'))); }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="costPerLiter"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preço/Litro (€)</FormLabel>
              <FormControl>
                <Input
                  type="number" step="0.001" min="0" inputMode="decimal" placeholder="1,650" {...field}
                  onChange={(e) => { field.onChange(e); recalcTotal(Number(form.getValues('liters')), Number(e.target.value)); }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="totalCost"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Total (€)</FormLabel>
              <FormControl><Input type="number" step="0.01" min="0" inputMode="decimal" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
        <FormField
          control={form.control}
          name="fuelType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Combustível</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {FUEL_TYPES.map((f) => <SelectItem key={f.code} value={f.code}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="fullTank"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-3 rounded-md border border-border p-3 space-y-0">
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="font-normal">Depósito cheio</FormLabel>
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="gasStationName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Posto (opcional)</FormLabel>
              <FormControl><Input placeholder="Galp, BP, Repsol..." {...field} /></FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="gasStationLocation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Local (opcional)</FormLabel>
              <FormControl><Input placeholder="Lisboa, Porto..." {...field} /></FormControl>
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notas (opcional)</FormLabel>
            <FormControl><Textarea placeholder="Observações..." {...field} /></FormControl>
          </FormItem>
        )}
      />
    </>
  );
}
