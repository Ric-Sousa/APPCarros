import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { post, handleApiError } from "@/lib/apiUtils";
import { localDateInput } from "@/lib/utils";
import { MAINTENANCE_TYPES, MAINTENANCE_KEYS } from "@/lib/maintenance";

const schema = z.object({
  type: z.string().min(1, "Tipo é obrigatório"),
  description: z.string().trim().min(1, "Descrição é obrigatória"),
  mileage: z.coerce.number<number>().int().min(0, "Quilometragem inválida").optional(),
  cost: z.coerce.number<number>().min(0, "Custo inválido").optional(),
  performedAt: z.string().min(1, "Data é obrigatória"),
  notes: z.string().optional(),
});
type Values = z.infer<typeof schema>;

interface Props {
  vehicle: { id: string; currentMileage: number };
  onDone: () => void;
}

/** Formulário único para registar uma manutenção (usado no modal do veículo e no histórico). */
export default function MaintenanceRecordForm({ vehicle, onDone }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { type: "", description: "", mileage: vehicle.currentMileage, cost: undefined, performedAt: localDateInput(), notes: "" },
  });

  const mutation = useMutation({
    // cost é uma coluna DECIMAL: o servidor espera texto; campos vazios não são enviados
    mutationFn: (v: Values) =>
      post(`/api/vehicles/${vehicle.id}/maintenance`, {
        type: v.type,
        description: v.description,
        performedAt: v.performedAt,
        ...(v.mileage ? { mileage: v.mileage } : {}),
        ...(v.cost ? { cost: String(v.cost) } : {}),
        ...(v.notes?.trim() ? { notes: v.notes.trim() } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", vehicle.id, "maintenance"] });
      MAINTENANCE_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      toast({ title: "Manutenção adicionada", description: "Registo de manutenção adicionado com sucesso!" });
      onDone();
    },
    onError: (error) => toast({ title: "Erro", description: handleApiError(error, "Erro ao adicionar manutenção."), variant: "destructive" }),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger data-testid="select-maintenance-type">
                      <SelectValue placeholder="Selecionar tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {MAINTENANCE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
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
                  <Input {...field} value={field.value ?? ""} type="number" step="0.01" min="0" placeholder="45,00" data-testid="input-maintenance-cost" />
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
                <Input {...field} placeholder="Mudança de óleo e filtro" data-testid="input-maintenance-description" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="mileage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quilometragem</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} type="number" min="0" placeholder="123000" data-testid="input-maintenance-mileage" />
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
                <FormLabel>Data</FormLabel>
                <FormControl>
                  <Input {...field} type="date" data-testid="input-maintenance-date" />
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
                <Textarea {...field} rows={3} placeholder="Peças utilizadas, oficina, etc." data-testid="textarea-maintenance-notes" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onDone} data-testid="button-cancel-maintenance">Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-maintenance">
            {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> : <Plus className="w-4 h-4 mr-2" aria-hidden="true" />}
            Adicionar
          </Button>
        </div>
      </form>
    </Form>
  );
}
