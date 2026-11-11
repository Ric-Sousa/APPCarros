import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Euro, Fuel, Gauge, Users, Wrench } from "lucide-react";
import type { Alert, ExpenseRecord, MaintenanceRecord } from "@shared/schema";
import { isElectric } from "@shared/fuel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AlertActions from "./AlertActions";
import EVComparisonCalculator from "./EVComparisonCalculator";
import { type VehicleWithRole, isOwner } from "@/hooks/useVehicles";
import { get } from "@/lib/apiUtils";
import { computeFuelStats, useFuelRecords } from "@/lib/fuelForm";
import { alertDueText, sortAlerts } from "@/lib/alerts";
import { daysUntil, formatDate, formatEuro, formatNumber } from "@/lib/utils";
import { maintenanceLabel } from "@/lib/maintenance";

function Deadline({ label, date }: { label: string; date: Date | string | null }) {
  const days = daysUntil(date);
  const tone = days === null ? "text-muted-foreground" : days < 0 ? "text-destructive" : days <= 30 ? "text-orange-600 dark:text-orange-400" : "text-foreground";
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${tone}`}>
        {formatDate(date, "Sem data")}
        {days !== null && days >= 0 && days <= 30 && ` · ${days === 0 ? "hoje" : `${days} d`}`}
      </span>
    </div>
  );
}

const thisMonth = (d: Date | string) => {
  const date = new Date(d);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

/** Separador "Resumo": prazos com ações rápidas, custos do mês, última manutenção, consumo e partilha. */
export default function VehicleSummary({ vehicle, onShare }: { vehicle: VehicleWithRole; onShare: () => void }) {
  const { data: alerts = [] } = useQuery<Alert[]>({ queryKey: ["/api/alerts"] });
  const { data: maintenance = [] } = useQuery<MaintenanceRecord[]>({ queryKey: ["/api/vehicles", vehicle.id, "maintenance"] });
  const { data: expenses = [] } = useQuery<ExpenseRecord[]>({
    queryKey: ["/api/expenses", vehicle.id],
    queryFn: () => get<ExpenseRecord[]>(`/api/expenses?vehicleId=${encodeURIComponent(vehicle.id)}`),
  });
  const { data: fuel = [] } = useFuelRecords(vehicle.id);
  const { data: members = [] } = useQuery<{ id: string; status: string }[]>({
    queryKey: ["/api/vehicles", vehicle.id, "members"],
    enabled: isOwner(vehicle),
  });

  const vehicleAlerts = sortAlerts(alerts.filter((a) => a.vehicleId === vehicle.id && !a.isDismissed));
  const stats = useMemo(() => computeFuelStats(fuel), [fuel]);
  const monthFuel = fuel.filter((r) => thisMonth(r.date)).reduce((s, r) => s + Number(r.totalCost), 0);
  const monthExpenses = expenses.filter((e) => thisMonth(e.date)).reduce((s, e) => s + Number(e.amount), 0);
  const lastMaintenance = [...maintenance].sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4" aria-hidden="true" /> Prazos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="divide-y divide-border">
              <Deadline label="Inspeção" date={vehicle.inspectionDue} />
              <Deadline label="IUC" date={vehicle.iucDue} />
              <Deadline label="Seguro" date={vehicle.insuranceDue} />
            </div>
            {vehicleAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tudo em dia.</p>
            ) : (
              <ul className="space-y-3">
                {vehicleAlerts.map((alert) => (
                  <li key={alert.id} className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-sm font-medium">{alert.title} <span className="font-normal text-muted-foreground">· {alertDueText(alert)}</span></p>
                    <AlertActions alert={alert} compact />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 content-start">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Euro className="h-3.5 w-3.5" aria-hidden="true" /> Este mês</p>
              <p className="text-xl font-bold">{formatEuro(monthFuel + monthExpenses)}</p>
              <p className="text-xs text-muted-foreground">{formatEuro(monthFuel)} {isElectric(vehicle.fuelType) ? "energia" : "combustível"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Fuel className="h-3.5 w-3.5" aria-hidden="true" /> Consumo médio</p>
              <p className="text-xl font-bold">{stats?.avgConsumption != null ? `${formatNumber(stats.avgConsumption, 1)}` : "—"}</p>
              <p className="text-xs text-muted-foreground">{stats?.avgConsumption != null ? "L/100 km" : "2+ abastecimentos"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Wrench className="h-3.5 w-3.5" aria-hidden="true" /> Última manutenção</p>
              <p className="text-sm font-semibold break-words">{lastMaintenance ? maintenanceLabel(lastMaintenance.type) : "—"}</p>
              <p className="text-xs text-muted-foreground">{lastMaintenance ? formatDate(lastMaintenance.performedAt) : "Sem registos"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Gauge className="h-3.5 w-3.5" aria-hidden="true" /> Quilómetros</p>
              <p className="text-xl font-bold">{formatNumber(vehicle.currentMileage)}</p>
              <Link href={`/expenses?veiculo=${vehicle.id}`} className="text-xs text-primary underline">Ver despesas</Link>
            </CardContent>
          </Card>
          <Card className="col-span-2">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {isOwner(vehicle)
                  ? members.length === 0
                    ? "Só você tem acesso a este veículo."
                    : `Partilhado com ${members.length} ${members.length === 1 ? "pessoa" : "pessoas"}.`
                  : `Partilhado consigo${vehicle.ownerName ? ` por ${vehicle.ownerName}` : ""}.`}
              </p>
              <Button size="sm" variant="outline" onClick={onShare}>{isOwner(vehicle) ? "Partilhar" : "Gerir acesso"}</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {!isElectric(vehicle.fuelType) && (
        <details className="group rounded-lg border border-border">
          <summary className="cursor-pointer p-4 font-medium">Comparar com um elétrico</summary>
          <div className="p-4 pt-0">
            <EVComparisonCalculator vehicleId={vehicle.id} />
          </div>
        </details>
      )}
    </div>
  );
}
