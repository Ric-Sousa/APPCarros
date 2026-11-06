import type { UseFormReturn } from "react-hook-form";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

export default function VehicleEditForm({ form, onSubmit, onCancel, isPending }: { form: UseFormReturn<any>; onSubmit: (data: any) => void; onCancel: () => void; isPending: boolean }) {
  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <h4 className="font-semibold mb-4">Editar Veículo</h4>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-3 gap-4">
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-fuel-type">
                        <SelectValue placeholder="Selecionar combustível" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="gasoline">Gasolina</SelectItem>
                      <SelectItem value="diesel">Diesel</SelectItem>
                      <SelectItem value="hybrid">Híbrido</SelectItem>
                      <SelectItem value="electric">Elétrico</SelectItem>
                      <SelectItem value="gas">GPL</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
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

            <h5 className="font-medium text-sm mt-6 mb-4 border-b pb-2">Informações dos Pneus</h5>
            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-3 gap-4">
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
                onClick={() => onCancel()}
                data-testid="button-cancel-edit"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-accent text-accent-foreground"
                disabled={isPending}
                data-testid="button-submit-edit"
              >
                {isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <Save className="w-4 h-4 mr-2" aria-hidden="true" />
                )}
                Guardar
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
