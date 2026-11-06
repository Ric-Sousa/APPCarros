import type { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';

/** Fields of the fuel record form (used by both the add and the edit dialogs). */
export default function FuelRecordFields({ form }: { form: UseFormReturn<any> }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
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
              <FormControl>
                <Input type="number" placeholder="120000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="liters"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Litros</FormLabel>
              <FormControl>
                <Input type="number" step="0.1" placeholder="45.5" {...field} />
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
                <Input type="number" step="0.001" placeholder="1.650" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="totalCost"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Total (€)</FormLabel>
            <FormControl>
              <Input type="number" step="0.01" readOnly {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="fuelType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo de Combustível</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="gasoline95">Gasolina 95</SelectItem>
                <SelectItem value="gasoline98">Gasolina 98</SelectItem>
                <SelectItem value="diesel">Gasóleo</SelectItem>
                <SelectItem value="hybrid">Híbrido</SelectItem>
                <SelectItem value="electric">Elétrico</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="gasStationName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Posto (Opcional)</FormLabel>
              <FormControl>
                <Input placeholder="Galp, BP, Repsol..." {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="gasStationLocation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Local (Opcional)</FormLabel>
              <FormControl>
                <Input placeholder="Lisboa, Porto..." {...field} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notas (Opcional)</FormLabel>
            <FormControl>
              <Textarea placeholder="Observações..." {...field} />
            </FormControl>
          </FormItem>
        )}
      />

    </>
  );
}
