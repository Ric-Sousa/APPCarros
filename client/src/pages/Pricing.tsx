import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import PublicLayout from "@/components/PublicLayout";
import { useAuth, AUTH_USER_KEY } from "@/hooks/useAuth";
import { useConfig } from "@/hooks/useConfig";
import { get, post, handleApiError } from "@/lib/apiUtils";
import { queryClient } from "@/lib/queryClient";
import { PLANS, type Plan, type PlanId } from "@shared/plans";

interface Billing {
  plan: PlanId;
  planExpiresAt: string | null;
  provider: "stripe" | "dev" | "none";
  canManage: boolean;
}

const euro = (n: number) => n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

/** Cartões dos planos; usado na página de planos e na página inicial. */
export function PlanCards({ current, onChoose, busy, footer }: {
  current?: PlanId;
  onChoose?: (plan: Plan) => void;
  busy?: PlanId | null;
  footer?: (plan: Plan) => React.ReactNode;
}) {
  const plans = Object.values(useConfig()?.plans ?? PLANS);
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {plans.map((plan) => (
        <Card key={plan.id} className={`flex flex-col ${plan.id === "premium" ? "border-primary shadow-lg" : ""}`}>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{plan.name}</CardTitle>
              {plan.id === "premium" && <Badge>Mais escolhido</Badge>}
              {current === plan.id && <Badge variant="secondary">Plano atual</Badge>}
            </div>
            <CardDescription>
              <span className="text-3xl font-bold text-foreground">{plan.priceMonthly === 0 ? "Grátis" : euro(plan.priceMonthly)}</span>
              {plan.priceMonthly > 0 && <span className="text-sm"> {plan.priceNote ?? "por mês"}</span>}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-2 text-sm">
              {plan.highlights.map((h) => (
                <li key={h} className="flex gap-2 text-foreground">
                  <Check className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" aria-hidden="true" /> {h}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            {footer ? footer(plan) : (
              <Button className="w-full" variant={plan.id === "premium" ? "default" : "outline"} disabled={current === plan.id || busy === plan.id} onClick={() => onChoose?.(plan)}>
                {busy === plan.id ? "A abrir..." : current === plan.id ? "Plano atual" : plan.priceMonthly === 0 ? "Começar grátis" : `Escolher ${plan.name}`}
              </Button>
            )}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export default function Pricing() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const search = useSearch();
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [vehicles, setVehicles] = useState(3);
  const notified = useRef(false);

  const { data: billing } = useQuery({
    queryKey: ["/api/billing"],
    queryFn: () => get<Billing>("/api/billing"),
    enabled: isAuthenticated,
  });

  // Regresso do checkout do fornecedor de pagamentos
  useEffect(() => {
    const result = new URLSearchParams(search).get("checkout");
    if (!result || notified.current) return;
    notified.current = true;
    if (result === "success") {
      toast({ title: "Subscrição ativa", description: "Obrigado! O seu plano foi atualizado." });
      queryClient.invalidateQueries({ queryKey: ["/api/billing"] });
      queryClient.invalidateQueries({ queryKey: AUTH_USER_KEY });
    } else {
      toast({ title: "Pagamento cancelado", description: "Não foi feita nenhuma cobrança." });
    }
  }, [search, toast]);

  const choose = async (plan: Plan) => {
    if (!isAuthenticated) {
      window.location.assign(`/register?next=${encodeURIComponent("/planos")}`);
      return;
    }
    setBusy(plan.id);
    try {
      if (billing?.provider === "dev") {
        await post("/api/billing/dev-activate", { plan: plan.id });
        toast({ title: `Plano ${plan.name} ativo`, description: "Ativado em modo de desenvolvimento (sem pagamento)." });
        await queryClient.invalidateQueries({ queryKey: ["/api/billing"] });
        await queryClient.invalidateQueries({ queryKey: AUTH_USER_KEY });
      } else if (plan.id === "free") {
        // Voltar ao grátis = cancelar no portal do fornecedor
        const { url } = await post<{ url: string }>("/api/billing/portal");
        window.location.assign(url);
      } else {
        const { url } = await post<{ url: string }>("/api/billing/checkout", { plan: plan.id, quantity: plan.id === "business" ? vehicles : undefined });
        window.location.assign(url);
      }
    } catch (error) {
      toast({ title: "Não foi possível mudar de plano", description: handleApiError(error), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const manage = async () => {
    try {
      const { url } = await post<{ url: string }>("/api/billing/portal");
      window.location.assign(url);
    } catch (error) {
      toast({ title: "Não foi possível abrir a gestão da subscrição", description: handleApiError(error), variant: "destructive" });
    }
  };

  const unavailable = isAuthenticated && billing?.provider === "none";

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-12 space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Planos simples, sem surpresas</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">Comece grátis. Mude de plano ou cancele quando quiser, sem fidelização.</p>
          {billing?.provider === "dev" && (
            <p className="text-sm text-amber-600 dark:text-amber-400">Modo de desenvolvimento: a mudança de plano é imediata e sem pagamento.</p>
          )}
          {unavailable && <p className="text-sm text-muted-foreground">Os pagamentos ainda não estão disponíveis. Brevemente!</p>}
        </div>

        <PlanCards
          current={isAuthenticated ? billing?.plan : undefined}
          busy={busy}
          onChoose={unavailable ? undefined : choose}
          footer={!isAuthenticated ? (plan) => (
            <Button asChild className="w-full" variant={plan.id === "premium" ? "default" : "outline"}>
              <Link href={`/register?next=${encodeURIComponent("/planos")}`}>{plan.priceMonthly === 0 ? "Começar grátis" : `Experimentar ${plan.name}`}</Link>
            </Button>
          ) : undefined}
        />

        {isAuthenticated && !unavailable && (
          <div className="flex flex-wrap items-end justify-center gap-4">
            <div className="space-y-1">
              <Label htmlFor="fleet-size">Veículos no plano Empresas</Label>
              <Input id="fleet-size" type="number" min={1} max={500} value={vehicles} onChange={(e) => setVehicles(Math.max(1, Number(e.target.value) || 1))} className="w-32" />
            </div>
            {billing?.canManage && billing.provider === "stripe" && (
              <Button variant="outline" onClick={manage}>Gerir subscrição e faturas</Button>
            )}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">Preços com IVA incluído. Pagamento mensal; pode cancelar a qualquer momento nas definições.</p>
      </div>
    </PublicLayout>
  );
}
