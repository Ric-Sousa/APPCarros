import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import DeadlineSuggestion from "./DeadlineSuggestion";

const DATES = [
  { name: "inspectionDue", label: "Próxima Inspeção", testId: "input-inspection-due", suggest: true },
  { name: "iucDue", label: "Vencimento IUC", testId: "input-iuc-due", suggest: true },
  { name: "insuranceDue", label: "Vencimento Seguro", testId: "input-insurance-due", suggest: false },
] as const;

/** Inspection / IUC / insurance due dates of the add-vehicle form, with suggestions from the registration date. */
export default function VehicleDatesFields({ form }: { form: UseFormReturn<any> }) {
  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Datas Importantes</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {DATES.map(({ name, label, testId, suggest }) => (
          <FormField
            key={name}
            control={form.control}
            name={name}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{label}</FormLabel>
                <FormControl>
                  <Input {...field} type="date" data-testid={testId} />
                </FormControl>
                {suggest && <DeadlineSuggestion form={form} field={name} />}
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
      </div>
    </div>
  );
}
