import { useWatch, type UseFormReturn } from "react-hook-form";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { suggestDeadlines } from "@/lib/deadlineHints";
import { formatDate } from "@/lib/utils";

const TEXT = {
  iucDue: (d: string) => `Sugestão: IUC até ${formatDate(d)} (mês da matrícula)`,
  inspectionDue: (d: string) => `Sugestão: inspeção em ${formatDate(d)} (pela idade do veículo)`,
} as const;

/**
 * Sugere a data do IUC ou da inspeção a partir da data de matrícula, quando o campo está vazio.
 * A data de matrícula vem do próprio formulário (campo `registrationDate`) ou de `registrationDate`.
 */
export default function DeadlineSuggestion({
  form,
  field,
  registrationDate,
  vehicleCategory,
  iucCategory,
}: {
  form: UseFormReturn<any>;
  field: "iucDue" | "inspectionDue";
  registrationDate?: unknown;
  vehicleCategory?: string | null;
  iucCategory?: string | null;
}) {
  const [current, formReg, formCategory, formIuc] = useWatch({
    control: form.control,
    name: [field, "registrationDate", "vehicleCategory", "iucCategory"],
  });
  if (current) return null;
  const suggestion = suggestDeadlines(formReg || registrationDate, formCategory || vehicleCategory, formIuc || iucCategory)[field];
  if (!suggestion) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Lightbulb className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      <span>{TEXT[field](suggestion)}</span>
      <Button
        type="button"
        size="sm"
        variant="link"
        className="h-auto p-0 text-xs"
        onClick={() => form.setValue(field, suggestion, { shouldDirty: true, shouldValidate: true })}
      >
        Usar
      </Button>
    </div>
  );
}
