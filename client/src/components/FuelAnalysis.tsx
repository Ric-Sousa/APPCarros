import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Fuel, TrendingUp, Calculator, MapPin } from "lucide-react";

export interface FuelAnalysisStats {
  avgConsumption: string;
  totalSpent: string;
  avgCostPerLiter: string;
  totalLiters: string;
  totalDistance: number;
  monthlyData: Record<string, { cost: number; liters: number; records: number }>;
  recordsCount: number;
}

/** "Análise" tab of the fuel page: totals, monthly breakdown and tips. */
export default function FuelAnalysis({ fuelStats, onAddRecord }: { fuelStats: FuelAnalysisStats | null; onAddRecord: () => void }) {
  return (
    <div className="space-y-6">
      {fuelStats ? (
        <>
          {/* Estatísticas Gerais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Calculator className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-gray-600">Consumo Médio</p>
                    <p className="text-2xl font-bold">{fuelStats.avgConsumption} L/100km</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Fuel className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm text-gray-600">Total Gasto</p>
                    <p className="text-2xl font-bold">€{fuelStats.totalSpent}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-sm text-gray-600">Preço Médio/L</p>
                    <p className="text-2xl font-bold">€{fuelStats.avgCostPerLiter}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-sm text-gray-600">Total Litros</p>
                    <p className="text-2xl font-bold">{fuelStats.totalLiters}L</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Gastos Mensais */}
          <Card>
            <CardHeader>
              <CardTitle>Gastos Mensais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(fuelStats.monthlyData)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([month, data]) => {
                    const maxCost = Math.max(...Object.values(fuelStats.monthlyData).map(d => d.cost));
                    const percentage = (data.cost / maxCost) * 100;

                    return (
                      <div key={month} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">
                            {new Date(month + '-01').toLocaleDateString('pt-PT', { 
                              year: 'numeric', 
                              month: 'long' 
                            })}
                          </span>
                          <div className="text-right">
                            <span className="text-sm font-bold">€{data.cost.toFixed(2)}</span>
                            <span className="text-xs text-gray-500 ml-2">({data.liters.toFixed(1)}L)</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {data.records} abastecimento{data.records !== 1 ? 's' : ''}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          {/* Insights e Recomendações */}
          <Card>
            <CardHeader>
              <CardTitle>Insights e Recomendações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">💡 Análise de Consumo</h4>
                  <p className="text-blue-700 text-sm">
                    {parseFloat(fuelStats.avgConsumption) > 8 
                      ? "O seu consumo está acima da média. Considere verificar a pressão dos pneus e realizar uma manutenção preventiva."
                      : parseFloat(fuelStats.avgConsumption) > 6
                      ? "O seu consumo está dentro da média para este tipo de veículo."
                      : "Excelente! O seu consumo está abaixo da média, indicando uma condução eficiente."
                    }
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">📊 Estatísticas</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm text-green-700">
                    <div>
                      <span className="font-medium">Total de registos:</span>
                      <span className="ml-2">{fuelStats.recordsCount}</span>
                    </div>
                    <div>
                      <span className="font-medium">Distância percorrida:</span>
                      <span className="ml-2">{fuelStats.totalDistance > 0 ? `${fuelStats.totalDistance} km` : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {parseFloat(fuelStats.avgCostPerLiter) > 1.7 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-800 mb-2">💰 Dica de Poupança</h4>
                    <p className="text-yellow-700 text-sm">
                      O preço médio que está a pagar está acima de €1.70/L. 
                      Considere usar aplicações como a "Mais Gasolina" para encontrar postos mais baratos.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Sem dados para análise</h3>
                <p className="text-muted-foreground mb-4">
                  Adicione alguns registos de combustível para ver análises detalhadas.
                </p>
                <Button onClick={onAddRecord}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeiro Registo
                </Button>
              </div>
            </CardContent>
          </Card>
      )}
    </div>
  );
}
