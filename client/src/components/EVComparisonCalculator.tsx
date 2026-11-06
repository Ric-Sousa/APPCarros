import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Zap, Battery, Calculator, TrendingDown, Leaf, Euro, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { post } from '@/lib/apiUtils';

interface EVComparison {
  currentVehicle: {
    fuelCostPerMonth: number;
    maintenanceCost: number;
    co2EmissionsPerMonth: number;
  };
  electricAlternative: {
    model: string;
    price: number;
    range: number;
    chargingCost: number;
    maintenanceCost: number;
    co2Emissions: number;
    incentives: number;
  };
    paybackPeriod: number | null; // months; null = never pays back
  totalSavings5Years: number;
}

/** TCO calculator: current (combustion) vehicle vs. an electric alternative. */
export default function EVComparisonCalculator({ vehicleId }: { vehicleId: string }) {
  const { toast } = useToast();
  const [evComparison, setEvComparison] = useState<EVComparison | null>(null);
  const [evIsDemo, setEvIsDemo] = useState(false);
  const [monthlyKm, setMonthlyKm] = useState<number>(1000);
  const [currentFuelPrice, setCurrentFuelPrice] = useState<number>(1.65);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateEVComparison = async () => {
    if (!vehicleId || isCalculating) return; // Prevent multiple simultaneous calls
    
    setIsCalculating(true);
    try {
            const response = await post<{ data: EVComparison; demo?: boolean }>('/api/ev-comparison', {
        vehicleId,
        monthlyKm,
        currentFuelPrice
      });
      setEvComparison(response.data);
      setEvIsDemo(!!response.demo);
    } catch (error) {
      toast({
        title: "Erro no cálculo",
        description: "Não foi possível calcular a comparação EV. Tente novamente.",
        variant: "destructive"
      });
      setEvComparison(null);
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    if (vehicleId) {
      calculateEVComparison();
    }
  }, [vehicleId]); // Only depend on vehicleId, not the function

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
                        Calculadora TCO - Elétrico vs Combustão
          {evIsDemo && <Badge variant="outline">Valores de referência</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Input Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Quilómetros por Mês</Label>
            <Input
              type="number"
              value={monthlyKm}
              onChange={(e) => setMonthlyKm(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Preço Combustível (€/L)</Label>
            <Input
              type="number"
              step="0.01"
              value={currentFuelPrice}
              onChange={(e) => setCurrentFuelPrice(Number(e.target.value))}
            />
          </div>
          <div className="flex items-end">
            <Button 
              onClick={calculateEVComparison}
              disabled={isCalculating}
              className="w-full"
            >
              {isCalculating ? 'A Calcular...' : 'Recalcular'}
            </Button>
          </div>
        </div>

        {/* Comparison Results */}
        {evComparison && evComparison.currentVehicle && (
          <div className="space-y-4">

            {/* Monthly Costs Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Veículo Atual (Combustão)
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Combustível/mês:</span>
                    <span className="font-medium">€{evComparison.currentVehicle.fuelCostPerMonth || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Manutenção/mês:</span>
                    <span className="font-medium">€{evComparison.currentVehicle.maintenanceCost || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CO₂/mês:</span>
                    <span className="font-medium">{evComparison.currentVehicle.co2EmissionsPerMonth || 0}kg</span>
                  </div>
                  <hr />
                  <div className="flex justify-between font-semibold">
                    <span>Total/mês:</span>
                    <span>€{(evComparison.currentVehicle.fuelCostPerMonth || 0) + (evComparison.currentVehicle.maintenanceCost || 0)}</span>
                  </div>
                </div>
              </div>

              {evComparison.electricAlternative && (
                <div className="border rounded-lg p-4 bg-green-50">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Battery className="h-4 w-4" />
                    {evComparison.electricAlternative.model || 'Veículo Elétrico'}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Carregamento/mês:</span>
                      <span className="font-medium">€{evComparison.electricAlternative.chargingCost || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Manutenção/mês:</span>
                      <span className="font-medium">€{evComparison.electricAlternative.maintenanceCost || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CO₂/mês:</span>
                      <span className="font-medium text-green-600">{evComparison.electricAlternative.co2Emissions || 0}kg</span>
                    </div>
                    <hr />
                    <div className="flex justify-between font-semibold">
                      <span>Total/mês:</span>
                      <span className="text-green-600">€{(evComparison.electricAlternative.chargingCost || 0) + (evComparison.electricAlternative.maintenanceCost || 0)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <Clock className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold text-blue-600">{evComparison.paybackPeriod ?? '—'}</div>
                <div className="text-sm text-blue-800">Meses Payback</div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg text-center">
                <Euro className="h-6 w-6 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-green-600">€{evComparison.totalSavings5Years}</div>
                <div className="text-sm text-green-800">Poupança 5 Anos</div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <TrendingDown className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold text-purple-600">€{evComparison.electricAlternative?.incentives || 0}</div>
                <div className="text-sm text-purple-800">Incentivos Estado</div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg text-center">
                <Leaf className="h-6 w-6 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-green-600">{evComparison.electricAlternative?.range || 0}</div>
                <div className="text-sm text-green-800">km Autonomia</div>
              </div>
            </div>

            <Alert>
              <Leaf className="h-4 w-4" />
              <AlertDescription>
                <strong>Impacto Ambiental:</strong> Ao mudar para elétrico, pouparia {evComparison.currentVehicle?.co2EmissionsPerMonth || 0}kg de CO₂ por mês, 
                equivalente a plantar {Math.round((evComparison.currentVehicle?.co2EmissionsPerMonth || 0) / 22)} árvores mensalmente.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
