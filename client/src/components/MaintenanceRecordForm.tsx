import type { UseFormReturn } from "react-hook-form";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function MaintenanceRecordForm({ form, onSubmit, onCancel, isPending }: { form: UseFormReturn<any>; onSubmit: (data: any) => void; onCancel: () => void; isPending: boolean }) {
  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <h4 className="font-semibold mb-4">Adicionar Manutenção</h4>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-maintenance-type">
                          <SelectValue placeholder="Selecionar tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="oil_change">Troca de Óleo</SelectItem>
                        <SelectItem value="tire_change">Troca de Pneus</SelectItem>
                        <SelectItem value="inspection">Inspeção</SelectItem>
                        <SelectItem value="repair">Reparação</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custo (€)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        step="0.01"
                        placeholder="45.00"
                        data-testid="input-maintenance-cost"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Troca de óleo - Castrol GTX"
                      data-testid="input-maintenance-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quilometragem</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number"
                        placeholder="123000"
                        data-testid="input-maintenance-mileage"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="performedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data e Hora</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="datetime-local"
                        data-testid="input-maintenance-date"
                      />
                    </FormControl>
                    <FormMessage />
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
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Notas adicionais sobre a manutenção..."
                      data-testid="textarea-maintenance-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex space-x-3">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => onCancel()}
                data-testid="button-cancel-maintenance"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-secondary text-secondary-foreground"
                disabled={isPending}
                data-testid="button-submit-maintenance"
              >
                {isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                )}
                Adicionar
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
