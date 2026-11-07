import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FUEL_TYPES } from "@shared/fuel";

/** Brand/model/year/fuel and registration (InformAtrículas) fields of the add-vehicle form. */
export default function VehicleRegistrationFields({ form }: { form: UseFormReturn<any> }) {
  return (
    <>
      {/* Auto-populated fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="brand"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Marca</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="BMW"
                  data-testid="input-brand"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Modelo</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="X3"
                  data-testid="input-model"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="year"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ano de Produção</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  placeholder="2020"
                  data-testid="input-year"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="registrationDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data de Registo</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  placeholder="06/1994"
                  data-testid="input-registration-date"
                />
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
              <FormLabel>Combustível</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl>
                  <SelectTrigger data-testid="select-fuel-type">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {FUEL_TYPES.map((f) => (
                    <SelectItem key={f.code} value={f.code}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* InformAtrículas Data */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Dados da Matrícula
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="originalColor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cor Original</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Branco" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="origin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Origem</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Portugal" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="registrationLocation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Local de Registo</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Braga" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="iucCategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria IUC</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Categoria IUC" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="powerCV"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Potência (CV)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" placeholder="150" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="powerKW"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Potência (kW)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" placeholder="110" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="engineDisplacement"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cilindrada (cc)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" placeholder="1600" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="certifyingEntity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Entidade Certificadora</FormLabel>
              <FormControl>
                <Input {...field} placeholder="IMTT" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="vehicleCategory"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria do Veículo</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Automóvel de passageiros" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
}
