import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Vehicle } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { post, handleApiError } from "@/lib/apiUtils";
import { localDateInput } from "@/lib/utils";
import { EXPENSE_CATEGORIES } from "@/lib/expenses";

const schema = z.object({
  vehicleId: z.string().min(1, "Veículo é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  amount: z.coerce.number<number>().min(0.01, "O valor deve ser superior a 0"),
  date: z.string().min(1, "Data é obrigatória"),
  description: z.string().optional(),
  vendor: z.string().optional(),
  mileage: z.coerce.number<number>().int().min(0, "Quilometragem inválida").optional(),
});
type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Vehicle[];
  defaultVehicleId?: string;
}

export default function ExpenseFormDialog({ open, onOpenChange, vehicles, defaultVehicleId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { vehicleId: "", category: "", amount: 0, date: localDateInput(), description: "", vendor: "", mileage: undefined },
  });

  useEffect(() => {
    if (open) form.reset({ vehicleId: defaultVehicleId ?? "", category: "", amount: 0, date: localDateInput(), description: "", vendor: "", mileage: undefined });
  }, [open, defaultVehicleId, form]);

  const mutation = useMutation({
    mutationFn: (v: Values) =>
      post("/api/expenses", {
        vehicleId: v.vehicleId,
        type: v.category,
        category: v.category,
        amount: v.amount,
        date: v.date,
        ...(v.description?.trim() ? { description: v.description.trim() } : {}),
        ...(v.vendor?.trim() ? { vendor: v.vendor.trim() } : {}),
        ...(v.mileage ? { mileage: v.mileage } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Despesa registada" });
      onOpenChange(false);
    },
    onError: (error) => toast({ title: "Erro", description: handleApiError(error, "Erro ao registar a despesa."), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registar Despesa</DialogTitle>
          <DialogDescription>Para recibos em papel ou PDF use "Processar Recibo (OCR)".</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Veículo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecionar veículo" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} — {v.licensePlate}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Tipo de despesa" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.entries(EXPENSE_CATEGORIES).map(([key, c]) => <SelectItem key={key} value={key}>{c.icon} {c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (€)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0,00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vendor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornecedor</FormLabel>
                    <FormControl><Input placeholder="Local da despesa" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quilometragem (opcional)</FormLabel>
                    <FormControl><Input type="number" min="0" inputMode="numeric" placeholder="123000" {...field} value={field.value ?? ""} /></FormControl>
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
                  <FormControl><Textarea placeholder="Descrição da despesa" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "A guardar..." : "Guardar"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
