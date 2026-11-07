import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Vehicle } from "@shared/schema";
import { FUEL_TYPES, normalizeFuelType } from "@shared/fuel";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { patch, handleApiError } from "@/lib/apiUtils";
import { toDateInput } from "@/lib/utils";

const optionalKm = z.coerce.number<number>().int().min(0, "Quilometragem inválida").optional();

const schema = z.object({
  licensePlate: z.string().min(1, "Matrícula é obrigatória"),
  brand: z.string().min(1, "Marca é obrigatória"),
  model: z.string().min(1, "Modelo é obrigatório"),
  year: z.coerce.number<number>().int().min(1900, "Ano inválido").max(new Date().getFullYear() + 1, "Ano inválido"),
  fuelType: z.string().optional(),
  currentMileage: z.coerce.number<number>().int().min(0, "Quilometragem inválida"),
  oilBrand: z.string().optional(),
  lastOilChange: z.string().optional(),
  lastOilChangeMileage: optionalKm,
  oilChangeInterval: z.coerce.number<number>().int().min(1000, "Intervalo deve ser pelo menos 1000 km").optional(),
  tireBrand: z.string().optional(),
  lastTireChange: z.string().optional(),
  lastTireChangeMileage: optionalKm,
  tireChangeInterval: z.coerce.number<number>().int().min(10000, "Intervalo deve ser pelo menos 10000 km").optional(),
  inspectionDue: z.string().optional(),
  iucDue: z.string().optional(),
  insuranceDue: z.string().optional(),
});
type Values = z.infer<typeof schema>;

const toValues = (v: Vehicle): Values => ({
  licensePlate: v.licensePlate,
  brand: v.brand,
  model: v.model,
  year: v.year,
  fuelType: normalizeFuelType(v.fuelType) ?? "",
  currentMileage: v.currentMileage,
  oilBrand: v.oilBrand ?? "",
  lastOilChange: toDateInput(v.lastOilChange),
  lastOilChangeMileage: v.lastOilChangeMileage ?? undefined,
  oilChangeInterval: v.oilChangeInterval ?? 15000,
  tireBrand: v.tireBrand ?? "",
  lastTireChange: toDateInput(v.lastTireChange),
  lastTireChangeMileage: v.lastTireChangeMileage ?? undefined,
  tireChangeInterval: v.tireChangeInterval ?? 50000,
  inspectionDue: toDateInput(v.inspectionDue),
  iucDue: toDateInput(v.iucDue),
  insuranceDue: toDateInput(v.insuranceDue),
});

/** Edição dos dados do veículo (a foto muda-se só pela galeria de fotos). */
export default function VehicleEditForm({ vehicle, onDone }: { vehicle: Vehicle; onDone: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(vehicle) });

  const mutation = useMutation({
    // Campos vazios vão como null (para limpar a data); id/userId/imageUrl nunca são enviados
    mutationFn: (v: Values) =>
      patch(`/api/vehicles/${vehicle.id}`, Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val === "" ? null : val]))),
    onSuccess: () => {
      [["/api/vehicles"], ["/api/stats"], ["/api/alerts"]].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      toast({ title: "Veículo atualizado", description: "Dados do veículo atualizados com sucesso!" });
      onDone();
    },
    onError: (error) => toast({ title: "Erro", description: handleApiError(error, "Erro ao atualizar o veículo."), variant: "destructive" }),
  });

  return (
    <Card className="mt-6">
      <CardContent className="p-4 sm:p-6">
        <h4 className="font-semibold mb-4">Editar Veículo</h4>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="licensePlate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matrícula</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="AB-12-CD"
                        data-testid="input-edit-license-plate"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currentMileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quilometragem Atual</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number"
                        placeholder="123000"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : "")}
                        data-testid="input-edit-mileage"
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
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="BMW"
                        data-testid="input-edit-brand"
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
                        placeholder="320d"
                        data-testid="input-edit-model"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ano</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number"
                        placeholder="2020"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : "")}
                        data-testid="input-edit-year"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="fuelType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Combustível</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-fuel-type">
                        <SelectValue placeholder="Selecionar combustível" />
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="oilBrand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca do Óleo</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Castrol GTX"
                        data-testid="input-edit-oil-brand"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="oilChangeInterval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Intervalo Troca Óleo (km)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number"
                        placeholder="15000"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : "")}
                        data-testid="input-edit-oil-interval"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="lastOilChange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Última Troca de Óleo</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="date"
                        data-testid="input-edit-last-oil-change"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastOilChangeMileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>KMs na Última Troca de Óleo</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number"
                        placeholder="108000"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : "")}
                        data-testid="input-edit-last-oil-mileage"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <h5 className="font-medium text-sm mt-6 mb-4 border-b border-border pb-2">Informações dos Pneus</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tireBrand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca dos Pneus</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Michelin"
                        data-testid="input-edit-tire-brand"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tireChangeInterval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Intervalo Troca Pneus (km)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number"
                        placeholder="50000"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : "")}
                        data-testid="input-edit-tire-interval"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="lastTireChange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Última Troca de Pneus</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="date"
                        data-testid="input-edit-last-tire-change"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastTireChangeMileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>KMs na Última Troca de Pneus</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number"
                        placeholder="80000"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : "")}
                        data-testid="input-edit-last-tire-mileage"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <h5 className="font-medium text-sm mt-6 mb-4 border-b pb-2">Datas de Vencimento</h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="inspectionDue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vencimento da Inspeção</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="date"
                        data-testid="input-edit-inspection-due"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="iucDue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vencimento do IUC</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="date"
                        data-testid="input-edit-iuc-due"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="insuranceDue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vencimento do Seguro</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="date"
                        data-testid="input-edit-insurance-due"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex space-x-3 mt-6">
              <Button 
                type="button" 
                variant="outline"
                onClick={onDone}
                data-testid="button-cancel-edit"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-accent text-accent-foreground"
                disabled={mutation.isPending}
                data-testid="button-submit-edit"
              >
                {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4 mr-2" aria-hidden="true" />}
                Guardar
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
