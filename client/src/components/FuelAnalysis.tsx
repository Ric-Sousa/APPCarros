import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, Fuel, MapPin, Plus, TrendingUp } from "lucide-react";
import type { FuelStats } from "@/lib/fuelForm";
import { formatEuro, formatNumber } from "@/lib/utils";

function Stat({ icon: Icon, label, value, color }: { icon: typeof Fuel; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${color}`} aria-hidden="true" />
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Separador "Análise" da página Combustível: totais, gastos por mês e conselhos. */
export default function FuelAnalysis({ stats, onAddRecord }: { stats: FuelStats | null; onAddRecord: () => void }) {
  if (!stats) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground mb-4" aria-hidden="true" />
          <h3 className="text-lg font-semibold mb-2">Sem dados para análise</h3>
          <p className="text-muted-foreground mb-4">Adicione registos de combustível para ver a análise.</p>
          <Button onClick={onAddRecord}>
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Adicionar Primeiro Registo
          </Button>
        </CardContent>
      </Card>
    );
  }

  const maxCost = Math.max(...stats.monthly.map((m) => m.cost), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Calculator} color="text-blue-500" label="Consumo Médio" value={stats.avgConsumption != null ? `${formatNumber(stats.avgConsumption, 1)} L/100km` : "—"} />
        <Stat icon={Fuel} color="text-green-500" label="Total Gasto" value={formatEuro(stats.totalCost)} />
        <Stat icon={TrendingUp} color="text-purple-500" label="Preço Médio/L" value={`${formatNumber(stats.avgCostPerLiter, 3)} €`} />
        <Stat icon={MapPin} color="text-orange-500" label="Total Litros" value={`${formatNumber(stats.totalLiters, 1)} L`} />
      </div>

      <Card>
        <CardHeader><CardTitle>Gastos Mensais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {stats.monthly.map((m) => (
            <div key={m.month} className="space-y-2">
              <div className="flex justify-between items-center gap-2">
                <span className="text-sm font-medium capitalize">
                  {new Date(`${m.month}-01T00:00:00`).toLocaleDateString("pt-PT", { year: "numeric", month: "long" })}
                </span>
                <span className="text-right text-sm">
                  <span className="font-bold">{formatEuro(m.cost)}</span>
                  <span className="text-xs text-muted-foreground ml-2">({formatNumber(m.liters, 1)} L)</span>
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full" style={{ width: `${(m.cost / maxCost) * 100}%` }} />
              </div>
              <div className="text-xs text-muted-foreground">{m.count} abastecimento{m.count !== 1 ? "s" : ""}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Conselhos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {stats.avgConsumption != null && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
              <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Consumo</h4>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                {stats.avgConsumption > 8
                  ? "O consumo está acima do habitual. Verifique a pressão dos pneus e faça uma manutenção preventiva."
                  : stats.avgConsumption > 6
                    ? "O consumo está dentro do habitual."
                    : "Excelente: o consumo está abaixo do habitual, sinal de condução eficiente."}
              </p>
            </div>
          )}
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
            <h4 className="font-semibold text-green-900 dark:text-green-200 mb-2">Resumo</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-green-800 dark:text-green-300">
              <div><span className="font-medium">Registos:</span> {stats.count}</div>
              <div><span className="font-medium">Distância:</span> {stats.totalDistance > 0 ? `${formatNumber(stats.totalDistance)} km` : "—"}</div>
            </div>
          </div>
          {stats.avgCostPerLiter > 1.7 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/30">
              <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">Poupança</h4>
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                Está a pagar em média mais de 1,70 €/L. Compare preços no separador "Postos" antes de abastecer.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
