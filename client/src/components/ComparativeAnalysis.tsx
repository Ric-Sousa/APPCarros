import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { TrendingUp, TrendingDown, BarChart3, Trophy, Target, Lightbulb } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle } from 'lucide-react';
import { handleApiError } from '@/lib/apiUtils';

interface VehicleComparison {
  vehicleId: string;
  userConsumption?: number;
  averageConsumption?: number;
  userExpenses?: number;
  averageExpenses?: number;
  rankingPosition?: number;
  totalSimilarVehicles?: number;
  recommendations?: string[];
}

interface FleetComparison {
  userId: string;
  totalVehicles?: number;
  averageFuelConsumption?: number;
  totalMonthlyExpenses?: number;
  mostEfficientVehicle?: {
    id: string;
    brand: string;
    model: string;
    consumption: number;
  } | null;
  mostExpensiveVehicle?: {
    id: string;
    brand: string;
    model: string;
    monthlyExpenses: number;
  } | null;
  comparisonWithSimilarFleets?: {
    betterThan: number;
    totalFleets: number;
  };
}

interface ComparativeAnalysisProps {
  vehicleId: string;
  vehicleBrand: string;
  vehicleModel: string;
  showFleetComparison?: boolean;
}

const ComparativeAnalysis: React.FC<ComparativeAnalysisProps> = ({ 
  vehicleId, 
  vehicleBrand, 
  vehicleModel,
  showFleetComparison = false 
}) => {
    const vehicleQuery = useQuery<VehicleComparison>({ queryKey: ['/api/vehicles', vehicleId, 'compare'] });
  const fleetQuery = useQuery<FleetComparison>({
    queryKey: ['/api/stats/fleet-comparison'],
    enabled: showFleetComparison,
  });
  const vehicleComparison = vehicleQuery.data ?? null;
  const fleetComparison = fleetQuery.data ?? null;
  const loading = vehicleQuery.isLoading || (showFleetComparison && fleetQuery.isLoading);
  const queryError = vehicleQuery.error || fleetQuery.error;
  const error = queryError ? handleApiError(queryError) : '';

  const formatConsumption = (consumption: number | undefined | null) => {
    if (consumption === undefined || consumption === null || isNaN(consumption)) {
      return 'N/A';
    }
    return `${consumption.toFixed(1)} L/100km`;
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return 'N/A';
    }
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getPerformanceColor = (userValue: number | undefined | null, averageValue: number | undefined | null, lowerIsBetter: boolean = true) => {
    if (userValue === undefined || userValue === null || averageValue === undefined || averageValue === null) {
      return 'text-gray-600';
    }
    const isUserBetter = lowerIsBetter ? userValue < averageValue : userValue > averageValue;
    return isUserBetter ? 'text-green-600' : 'text-red-600';
  };

  const getPerformanceIcon = (userValue: number | undefined | null, averageValue: number | undefined | null, lowerIsBetter: boolean = true) => {
    if (userValue === undefined || userValue === null || averageValue === undefined || averageValue === null) {
      return <TrendingUp className="h-4 w-4" />;
    }
    const isUserBetter = lowerIsBetter ? userValue < averageValue : userValue > averageValue;
    return isUserBetter ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />;
  };

  const calculateProgressValue = (userValue: number | undefined | null, averageValue: number | undefined | null) => {
    if (userValue === undefined || userValue === null || averageValue === undefined || averageValue === null || averageValue === 0) {
      return 50; // Default neutral value
    }
    const ratio = userValue / averageValue;
    return Math.min(Math.max(ratio * 50, 0), 100); // Clamp between 0 and 100
  };

  const calculatePercentageDifference = (userValue: number | undefined | null, averageValue: number | undefined | null) => {
    if (userValue === undefined || userValue === null || averageValue === undefined || averageValue === null) return 0;
    if (averageValue === 0) return 0;
    return ((userValue - averageValue) / averageValue) * 100;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">A carregar análise comparativa...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Vehicle Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Análise Comparativa - {vehicleBrand} {vehicleModel}
          </CardTitle>
          <CardDescription>
            Compare o desempenho do seu veículo com outros similares
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {vehicleComparison && (
            <div className="space-y-6">
              {/* Consumption Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Consumo de Combustível</span>
                    <div className={`flex items-center gap-1 ${getPerformanceColor(vehicleComparison.userConsumption, vehicleComparison.averageConsumption)}`}>
                      {getPerformanceIcon(vehicleComparison.userConsumption, vehicleComparison.averageConsumption)}
                      <span className="text-sm font-medium">
                        {calculatePercentageDifference(vehicleComparison.userConsumption, vehicleComparison.averageConsumption) > 0 ? '+' : ''}
                        {calculatePercentageDifference(vehicleComparison.userConsumption, vehicleComparison.averageConsumption).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>O seu: {formatConsumption(vehicleComparison.userConsumption)}</span>
                    <span className="text-muted-foreground">
                      Média: {formatConsumption(vehicleComparison.averageConsumption)}
                    </span>
                  </div>
                  <Progress 
                    value={calculateProgressValue(vehicleComparison.userConsumption, vehicleComparison.averageConsumption)} 
                    className="h-2" 
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Despesas Mensais</span>
                    <div className={`flex items-center gap-1 ${getPerformanceColor(vehicleComparison.userExpenses, vehicleComparison.averageExpenses)}`}>
                      {getPerformanceIcon(vehicleComparison.userExpenses, vehicleComparison.averageExpenses)}
                      <span className="text-sm font-medium">
                        {calculatePercentageDifference(vehicleComparison.userExpenses, vehicleComparison.averageExpenses) > 0 ? '+' : ''}
                        {calculatePercentageDifference(vehicleComparison.userExpenses, vehicleComparison.averageExpenses).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>O seu: {formatCurrency(vehicleComparison.userExpenses)}</span>
                    <span className="text-muted-foreground">
                      Média: {formatCurrency(vehicleComparison.averageExpenses)}
                    </span>
                  </div>
                  <Progress 
                    value={calculateProgressValue(vehicleComparison.userExpenses, vehicleComparison.averageExpenses)} 
                    className="h-2" 
                  />
                </div>
              </div>

              {/* Ranking */}
              <div className="flex items-center justify-center p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    <span className="font-semibold">Classificação</span>
                  </div>
                  <p className="text-2xl font-bold">
                    #{vehicleComparison.rankingPosition || 'N/A'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    de {vehicleComparison.totalSimilarVehicles || 0} veículos similares
                  </p>
                </div>
              </div>

              {/* Recommendations */}
              {vehicleComparison.recommendations && vehicleComparison.recommendations.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium text-sm">Recomendações</span>
                  </div>
                  <div className="space-y-2">
                    {vehicleComparison.recommendations.map((recommendation, index) => (
                      <div key={index} className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
                        <Target className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-yellow-800">{recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fleet Comparison */}
      {showFleetComparison && fleetComparison && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Comparação da Frota
            </CardTitle>
            <CardDescription>
              Visão geral dos seus veículos comparados com outras frotas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <h3 className="font-semibold text-lg">{fleetComparison.totalVehicles || 0}</h3>
                <p className="text-sm text-muted-foreground">Veículos Totais</p>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <h3 className="font-semibold text-lg">
                  {formatConsumption(fleetComparison.averageFuelConsumption)}
                </h3>
                <p className="text-sm text-muted-foreground">Consumo Médio</p>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <h3 className="font-semibold text-lg">
                  {formatCurrency(fleetComparison.totalMonthlyExpenses)}
                </h3>
                <p className="text-sm text-muted-foreground">Despesas Mensais</p>
              </div>
            </div>

            {(fleetComparison.mostEfficientVehicle || fleetComparison.mostExpensiveVehicle) && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {fleetComparison.mostEfficientVehicle && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800">Mais Eficiente</span>
                    </div>
                    <p className="text-sm text-green-700">
                      {fleetComparison.mostEfficientVehicle.brand} {fleetComparison.mostEfficientVehicle.model}
                    </p>
                    <p className="text-xs text-green-600">
                      {formatConsumption(fleetComparison.mostEfficientVehicle.consumption)}
                    </p>
                  </div>
                )}

                {fleetComparison.mostExpensiveVehicle && (
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-red-600" />
                      <span className="font-medium text-red-800">Mais Dispendioso</span>
                    </div>
                    <p className="text-sm text-red-700">
                      {fleetComparison.mostExpensiveVehicle.brand} {fleetComparison.mostExpensiveVehicle.model}
                    </p>
                    <p className="text-xs text-red-600">
                      {formatCurrency(fleetComparison.mostExpensiveVehicle.monthlyExpenses)}/mês
                    </p>
                  </div>
                )}
              </div>
            )}

            {fleetComparison.comparisonWithSimilarFleets && (
              <div className="mt-6 text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  A sua frota está melhor que <span className="font-semibold">{fleetComparison.comparisonWithSimilarFleets.betterThan}%</span> das frotas similares
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Baseado em {fleetComparison.comparisonWithSimilarFleets.totalFleets} frotas analisadas
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ComparativeAnalysis;
