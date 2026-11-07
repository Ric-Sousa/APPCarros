import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

/** Inspection / IUC / insurance due dates of the add-vehicle form. */
export default function VehicleDatesFields({ form }: { form: UseFormReturn<any> }) {
  return (
    <>
      {/* Important Dates */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Datas Importantes
        </h4>
        <div className="grid grid-cols-1 gap-4">
          <FormField
            control={form.control}
            name="inspectionDue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Próxima Inspeção</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="date"
                    data-testid="input-inspection-due"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="iucDue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vencimento IUC</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      data-testid="input-iuc-due"
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
                  <FormLabel>Vencimento Seguro</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      data-testid="input-insurance-due"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>
    </>
  );
}
