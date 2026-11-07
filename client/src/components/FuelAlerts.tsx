import { useMemo } from 'react';
import { AlertTriangle, Fuel, TrendingUp } from 'lucide-react';
import { consumptionL100 } from '@shared/calc';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useVehicles } from '@/hooks/useVehicles';
import { useAllFuelRecords } from '@/lib/fuelForm';
import { daysUntil, formatNumber } from '@/lib/utils';

interface FuelAlert {
  id: string;
  type: 'no_refuel' | 'high_consumption';
  high: boolean;
  title: string;
  description: string;
  vehicleName: string;
}

const STYLE = {
  true: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
  false: 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200',
};

/**
 * Estimativas a partir dos abastecimentos registados (não usa sensores do veículo).
 * Os prazos de manutenção vêm dos alertas do servidor (/api/alerts).
 */
export default function FuelAlerts() {
  const { data: vehicles = [] } = useVehicles();
  const { data: records = [] } = useAllFuelRecords();

  const alerts = useMemo(() => {
    const out: FuelAlert[] = [];
    for (const vehicle of vehicles) {
      const own = records.filter((r) => r.vehicleId === vehicle.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (own.length === 0) continue;
      const vehicleName = `${vehicle.brand} ${vehicle.model} — ${vehicle.licensePlate}`;

      const days = -(daysUntil(own[0].date) ?? 0);
      if (days > 20) {
        out.push({ id: `refuel-${vehicle.id}`, type: 'no_refuel', high: days > 45, title: 'Sem abastecimentos registados', description: `Último registo há ${days} dias. Não se esqueça de registar os abastecimentos.`, vehicleName });
      }

      const recent = consumptionL100(own.slice(0, 4));
      const overall = consumptionL100(own);
      if (recent != null && overall != null && own.length >= 5 && recent > overall * 1.15) {
        out.push({ id: `consumption-${vehicle.id}`, type: 'high_consumption', high: recent > overall * 1.3, title: 'Consumo a subir', description: `Consumo recente de ${formatNumber(recent, 1)} L/100km (média: ${formatNumber(overall, 1)}).`, vehicleName });
      }
    }
    return out.sort((a, b) => Number(b.high) - Number(a.high)).slice(0, 3);
  }, [vehicles, records]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          Alertas de Combustível
          {alerts.length > 0 && <Badge variant="secondary">{alerts.length}</Badge>}
          <Badge variant="outline" title="Calculado a partir dos seus registos; não usa sensores do veículo">Estimativa</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Fuel className="h-10 w-10 mx-auto mb-3 opacity-50" aria-hidden="true" />
            <p>Nenhum alerta ativo</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className={`flex items-start gap-3 rounded-lg border p-4 ${STYLE[String(alert.high) as 'true' | 'false']}`}>
              {alert.type === 'no_refuel' ? <Fuel className="h-5 w-5 shrink-0" aria-hidden="true" /> : <TrendingUp className="h-5 w-5 shrink-0" aria-hidden="true" />}
              <div className="min-w-0 space-y-1">
                <h4 className="font-medium">{alert.title}</h4>
                <p className="text-sm">{alert.description}</p>
                <p className="text-xs opacity-80">Veículo: <span className="font-medium">{alert.vehicleName}</span></p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
