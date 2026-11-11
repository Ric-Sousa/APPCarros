import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, ExternalLink } from "lucide-react";
import type { Alert } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { post } from "@/lib/apiUtils";
import { toastApiError } from "@/lib/planLimit";

/** Link útil para resolver o alerta fora da app. */
const ALERT_LINKS: Record<string, { label: string; href: string }> = {
  iuc: { label: "Pagar IUC", href: "https://www.portaldasfinancas.gov.pt" },
  inspection: { label: "Centros de inspeção", href: "https://www.imt-ip.pt" },
};

const ALERT_KEYS = [["/api/alerts"], ["/api/stats"], ["/api/vehicles"], ["/api/maintenance"]];

/** "Feito" (atualiza o próximo prazo), "Lembrar daqui a 3 dias" e o link para tratar do assunto. */
export default function AlertActions({ alert, compact = false }: { alert: Alert; compact?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const refresh = () => ALERT_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  const id = encodeURIComponent(alert.id);

  const done = useMutation({
    mutationFn: () => post(`/api/alerts/${id}/done`),
    onSuccess: () => {
      refresh();
      toast({ title: "Feito!", description: "O próximo prazo foi atualizado." });
    },
    onError: (error) => toastApiError(toast, error),
  });

  const snooze = useMutation({
    mutationFn: () => post(`/api/alerts/${id}/snooze`, { days: 3 }),
    onSuccess: () => {
      refresh();
      toast({ title: "Lembramos daqui a 3 dias" });
    },
    onError: (error) => toastApiError(toast, error),
  });

  const link = ALERT_LINKS[alert.type];
  const busy = done.isPending || snooze.isPending;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => done.mutate()} disabled={busy} data-testid={`button-alert-done-${alert.id}`}>
        <Check className="h-4 w-4 mr-1" aria-hidden="true" /> Feito
      </Button>
      <Button size="sm" variant="outline" onClick={() => snooze.mutate()} disabled={busy} aria-label={compact ? "Lembrar daqui a 3 dias" : undefined}>
        <Clock className="h-4 w-4 mr-1" aria-hidden="true" /> {compact ? "3 dias" : "Lembrar daqui a 3 dias"}
      </Button>
      {link && (
        <Button size="sm" variant="ghost" asChild>
          <a href={link.href} target="_blank" rel="noopener noreferrer">
            {link.label} <ExternalLink className="h-3 w-3 ml-1" aria-hidden="true" />
          </a>
        </Button>
      )}
    </div>
  );
}
