import { isPlanLimit, handleApiError } from "@/lib/apiUtils";

type Toast = (props: { title?: string; description?: string; variant?: "default" | "destructive" }) => unknown;

/**
 * Mostra o erro de um pedido. Os limites do plano (402) já têm aviso global com "Ver planos"
 * (PlanLimitToasts em App.tsx), por isso aqui não se mostra nada para não duplicar.
 */
export function toastApiError(toast: Toast, error: unknown, fallback = "Ocorreu um erro") {
  if (isPlanLimit(error)) return;
  toast({ title: "Erro", description: handleApiError(error, fallback), variant: "destructive" });
}
