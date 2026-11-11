import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import Sidebar from "@/components/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { get, handleApiError } from "@/lib/apiUtils";

interface Metrics {
  users: number;
  verifiedUsers: number;
  activeUsers7d: number;
  activation: { registered: number; withVehicle: number; withReminders: number };
  retentionD30: { cohort: number; retained: number };
  events: Record<string, number>;
  feedback: { id: string; message: string; page: string | null; createdAt: string; email: string | null }[];
}

const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : "—");

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold text-foreground">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/admin/metrics"],
    queryFn: () => get<Metrics>("/api/admin/metrics"),
    enabled: !!user?.isAdmin,
  });

  if (user && !user.isAdmin) return <Redirect to="/dashboard" />;

  const a = data?.activation;
  return (
    <Sidebar>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Administração</h1>
          <p className="text-muted-foreground">Métricas de produto (sem dados pessoais) e feedback dos utilizadores.</p>
        </div>
        {isLoading && <p className="text-muted-foreground" role="status">A carregar...</p>}
        {error && <p className="text-destructive">{handleApiError(error)}</p>}
        {data && a && (
          <>
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <Stat label="Utilizadores" value={data.users} />
              <Stat label="Email confirmado" value={pct(data.verifiedUsers, data.users)} hint={`${data.verifiedUsers} contas`} />
              <Stat label="Ativos (7 dias)" value={data.activeUsers7d} />
              <Stat label="Retenção a 30 dias" value={pct(data.retentionD30.retained, data.retentionD30.cohort)} hint={`${data.retentionD30.retained} de ${data.retentionD30.cohort}`} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Ativação</CardTitle>
                <CardDescription>Do registo até ter lembretes ativos (o objetivo da primeira experiência).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Registados", value: a.registered },
                  { label: "Com veículo", value: a.withVehicle },
                  { label: "Com lembretes ativos", value: a.withReminders },
                ].map((step) => (
                  <div key={step.label} className="space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-foreground">{step.label}</span><span className="text-muted-foreground">{step.value} ({pct(step.value, a.registered)})</span></div>
                    <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: pct(step.value, a.registered) === "—" ? "0%" : pct(step.value, a.registered) }} /></div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Eventos</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(data.events).sort((x, y) => y[1] - x[1]).map(([name, count]) => (
                    <div key={name} className="flex justify-between rounded border border-border px-3 py-2 text-sm">
                      <dt className="text-foreground">{name}</dt><dd className="text-muted-foreground">{count}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Feedback recente</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {data.feedback.length === 0 && <p className="text-sm text-muted-foreground">Ainda sem mensagens.</p>}
                {data.feedback.map((f) => (
                  <div key={f.id} className="rounded-lg border border-border p-3 space-y-1">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{f.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(f.createdAt).toLocaleString("pt-PT")} · {f.email ?? "anónimo"}{f.page ? ` · ${f.page}` : ""}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Sidebar>
  );
}
