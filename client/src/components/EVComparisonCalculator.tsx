import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calculator, Leaf, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { post, handleApiError } from '@/lib/apiUtils';
import { useDebounced } from '@/hooks/useVehicleSpecs';
import { formatEuro, formatNumber } from '@/lib/utils';

interface EVComparison {
  currentVehicle: { fuelCostPerMonth: number; maintenanceCost: number; co2EmissionsPerMonth: number };
  electricAlternative: {
    model: string;
    price: number;
    range: number;
    chargingCost: number;
    maintenanceCost: number;
    co2Emissions: number;
    incentives: number;
  };
  paybackPeriod: number | null; // meses; null = nunca compensa
  totalSavings5Years: number;
}

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`p-4 rounded-lg text-center ${tone}`}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

/** Custo mensal do veículo atual (combustão) vs. uma alternativa elétrica de referência. */
export default function EVComparisonCalculator({ vehicleId }: { vehicleId: string }) {
  const [monthlyKm, setMonthlyKm] = useState('1000');
  const [fuelPrice, setFuelPrice] = useState('1.65');
  const km = Number(useDebounced(monthlyKm, 600)) || 1000;
  const price = Number(useDebounced(fuelPrice, 600)) || 1.65;

  const { data, isFetching, error } = useQuery({
    queryKey: ['/api/ev-comparison', vehicleId, km, price],
    queryFn: () => post<{ data: EVComparison; demo?: boolean }>('/api/ev-comparison', { vehicleId, monthlyKm: km, currentFuelPrice: price }),
  });
  const c = data?.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Calculator className="h-5 w-5" aria-hidden="true" />
          Compensa passar para elétrico?
          {data?.demo && <Badge variant="outline">Valores de referência</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ev-monthly-km">Km por mês</Label>
            <Input id="ev-monthly-km" type="number" min="0" value={monthlyKm} onChange={(e) => setMonthlyKm(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-fuel-price">Preço do combustível (€/L)</Label>
            <Input id="ev-fuel-price" type="number" min="0" step="0.01" value={fuelPrice} onChange={(e) => setFuelPrice(e.target.value)} />
          </div>
        </div>

        {isFetching && !c && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A calcular...
          </p>
        )}
        {error && <p className="text-sm text-destructive">{handleApiError(error, 'Não foi possível calcular a comparação.')}</p>}

        {c && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-border rounded-lg p-4">
                <h4 className="font-medium mb-3">O seu veículo (por mês)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Combustível</span><span className="font-medium">{formatEuro(c.currentVehicle.fuelCostPerMonth)}</span></div>
                  <div className="flex justify-between"><span>Manutenção</span><span className="font-medium">{formatEuro(c.currentVehicle.maintenanceCost)}</span></div>
                  <div className="flex justify-between"><span>CO₂</span><span className="font-medium">{formatNumber(c.currentVehicle.co2EmissionsPerMonth)} kg</span></div>
                  <div className="flex justify-between border-t border-border pt-2 font-semibold">
                    <span>Total</span><span>{formatEuro(c.currentVehicle.fuelCostPerMonth + c.currentVehicle.maintenanceCost)}</span>
                  </div>
                </div>
              </div>
              <div className="border border-border rounded-lg p-4 bg-green-50 dark:bg-green-950/30">
                <h4 className="font-medium mb-3">{c.electricAlternative.model} (por mês)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Carregamento</span><span className="font-medium">{formatEuro(c.electricAlternative.chargingCost)}</span></div>
                  <div className="flex justify-between"><span>Manutenção</span><span className="font-medium">{formatEuro(c.electricAlternative.maintenanceCost)}</span></div>
                  <div className="flex justify-between"><span>CO₂</span><span className="font-medium text-green-700 dark:text-green-400">{formatNumber(c.electricAlternative.co2Emissions)} kg</span></div>
                  <div className="flex justify-between border-t border-border pt-2 font-semibold">
                    <span>Total</span><span className="text-green-700 dark:text-green-400">{formatEuro(c.electricAlternative.chargingCost + c.electricAlternative.maintenanceCost)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Tile label="Retorno do investimento" value={c.paybackPeriod != null ? `${c.paybackPeriod} meses` : 'Não compensa'} tone="bg-blue-50 dark:bg-blue-950/30" />
              <Tile label="Poupança em 5 anos" value={formatEuro(c.totalSavings5Years)} tone="bg-green-50 dark:bg-green-950/30" />
              <Tile label="Incentivos" value={formatEuro(c.electricAlternative.incentives)} tone="bg-purple-50 dark:bg-purple-950/30" />
              <Tile label="Autonomia" value={`${formatNumber(c.electricAlternative.range)} km`} tone="bg-muted" />
            </div>

            {c.currentVehicle.co2EmissionsPerMonth > c.electricAlternative.co2Emissions && (
              <Alert>
                <Leaf className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>
                  Com um elétrico emitiria menos {formatNumber(c.currentVehicle.co2EmissionsPerMonth - c.electricAlternative.co2Emissions)} kg de CO₂ por mês.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
