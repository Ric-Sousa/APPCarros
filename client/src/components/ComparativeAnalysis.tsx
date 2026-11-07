import { useQuery } from '@tanstack/react-query';
import { AlertCircle, BarChart3, Lightbulb, Target, TrendingDown, TrendingUp, Trophy, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { handleApiError } from '@/lib/apiUtils';
import { formatEuro, formatNumber } from '@/lib/utils';

/** Resposta de GET /api/vehicles/:id/compare — as médias só existem com veículos iguais suficientes */
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

interface Props {
  vehicleId: string;
  vehicleBrand: string;
  vehicleModel: string;
}

function Metric({ label, mine, average, format }: { label: string; mine?: number; average?: number; format: (v: number) => string }) {
  const comparable = mine != null && average != null && average > 0;
  const diff = comparable ? ((mine - average) / average) * 100 : 0;
  const better = diff < 0; // menos consumo/despesa é melhor
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {comparable && (
          <span className={`flex items-center gap-1 text-sm font-medium ${better ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {better ? <TrendingDown className="h-4 w-4" aria-hidden="true" /> : <TrendingUp className="h-4 w-4" aria-hidden="true" />}
            {diff > 0 ? '+' : ''}{formatNumber(diff, 1)}%
          </span>
        )}
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 text-sm">
        <span>O seu: {mine != null ? format(mine) : 'Sem dados'}</span>
        <span className="text-muted-foreground">Média: {average != null ? format(average) : '—'}</span>
      </div>
      {comparable && <Progress value={Math.min(Math.max((mine / average) * 50, 0), 100)} className="h-2" aria-label={`${label}: comparação com a média`} />}
    </div>
  );
}

export default function ComparativeAnalysis({ vehicleId, vehicleBrand, vehicleModel }: Props) {
  const { data, isLoading, error } = useQuery<VehicleComparison>({ queryKey: ['/api/vehicles', vehicleId, 'compare'] });
  const hasAverages = data?.averageConsumption != null || data?.averageExpenses != null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" aria-hidden="true" />
          Análise Comparativa — {vehicleBrand} {vehicleModel}
        </CardTitle>
        <CardDescription>Compare o seu veículo com outros da mesma marca e modelo</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && <p className="text-center text-muted-foreground" role="status">A carregar análise comparativa...</p>}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{handleApiError(error)}</AlertDescription>
          </Alert>
        )}

        {data && (
          <>
            {!hasAverages && (
              <div className="flex items-start gap-3 rounded-lg bg-muted p-4 text-sm">
                <Users className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p>
                  Ainda não há veículos iguais suficientes para comparar.
                  <span className="block text-muted-foreground">Por privacidade, as médias só aparecem quando existirem pelo menos 5 veículos {vehicleBrand} {vehicleModel} registados.</span>
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Metric label="Consumo de combustível" mine={data.userConsumption} average={data.averageConsumption} format={(v) => `${formatNumber(v, 1)} L/100 km`} />
              <Metric label="Despesas mensais" mine={data.userExpenses} average={data.averageExpenses} format={formatEuro} />
            </div>

            {data.rankingPosition != null && (
              <div className="flex items-center justify-center gap-4 rounded-lg bg-muted p-4 text-center">
                <Trophy className="h-6 w-6 text-yellow-500" aria-hidden="true" />
                <div>
                  <p className="text-2xl font-bold">#{data.rankingPosition}</p>
                  <p className="text-sm text-muted-foreground">em consumo, entre {(data.totalSimilarVehicles ?? 0) + 1} veículos iguais</p>
                </div>
              </div>
            )}

            {!!data.recommendations?.length && (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Lightbulb className="h-4 w-4 text-yellow-500" aria-hidden="true" /> Recomendações
                </p>
                {data.recommendations.map((r) => (
                  <div key={r} className="flex items-start gap-2 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
                    <Target className="mt-0.5 h-4 w-4 shrink-0 text-yellow-700 dark:text-yellow-400" aria-hidden="true" />
                    <p className="text-sm text-yellow-900 dark:text-yellow-200">{r}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
