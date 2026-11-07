import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lightbulb, Gauge, Clock, Wrench, TrendingUp, Loader2 } from 'lucide-react';
import { useDebounced, useVehicleSpecs, type VehicleRecommendations } from '@/hooks/useVehicleSpecs';
import { formatNumber } from '@/lib/utils';

interface VehicleRecommendationsCardProps {
  brand: string;
  model: string;
  onOilRecommendation?: (recommendations: string[]) => void;
  onTireRecommendation?: (recommendations: string[]) => void;
  onOilIntervalUpdate?: (intervalKm: number, intervalMonths: number) => void;
  onTireIntervalUpdate?: (intervalKm: number) => void;
}

/** Recomendações de óleo e pneus vindas do servidor (/api/vehicle-specs) para a marca/modelo escritos. */
export function VehicleRecommendationsCard({
  brand,
  model,
  onOilRecommendation,
  onTireRecommendation,
  onOilIntervalUpdate,
  onTireIntervalUpdate,
}: VehicleRecommendationsCardProps) {
  // Só pesquisa quando o utilizador pára de escrever
  const debouncedBrand = useDebounced(brand.trim(), 600);
  const debouncedModel = useDebounced(model.trim(), 600);
  const { data: recommendations, isFetching } = useVehicleSpecs(debouncedBrand, debouncedModel);

  // Callbacks numa ref: o efeito só corre quando chegam recomendações novas.
  // (Com os callbacks nas dependências, um pai que os recria a cada render entrava num ciclo infinito.)
  const callbacks = useRef({ onOilRecommendation, onTireRecommendation, onOilIntervalUpdate, onTireIntervalUpdate });
  callbacks.current = { onOilRecommendation, onTireRecommendation, onOilIntervalUpdate, onTireIntervalUpdate };

  useEffect(() => {
    if (!recommendations) return;
    const cb = callbacks.current;
    cb.onOilRecommendation?.(recommendations.oilRecommendations.recommendedBrands);
    cb.onTireRecommendation?.(recommendations.tireRecommendations.recommendedBrands);
    cb.onOilIntervalUpdate?.(recommendations.oilRecommendations.intervalKm, recommendations.oilRecommendations.intervalMonths);
    cb.onTireIntervalUpdate?.(recommendations.tireRecommendations.intervalKm);
  }, [recommendations]);

  if (!brand || !model) return null;
  if (!recommendations) {
    return isFetching ? (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A procurar recomendações...
      </div>
    ) : null;
  }

  return <RecommendationsView brand={debouncedBrand} model={debouncedModel} recommendations={recommendations} />;
}

function BrandBadges({ brands }: { brands: string[] }) {
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      <span className="text-xs text-muted-foreground mr-2">Marcas recomendadas:</span>
      {brands.slice(0, 4).map((name) => (
        <Badge key={name} variant="default" className="text-xs">{name}</Badge>
      ))}
    </div>
  );
}

function RecommendationsView({ brand, model, recommendations: r }: { brand: string; model: string; recommendations: VehicleRecommendations }) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" aria-hidden="true" />
          Recomendações para {brand} {model}
          <Badge variant={r.found ? 'default' : 'outline'} className="text-xs">{r.found ? 'Específica' : 'Genérica'}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" aria-hidden="true" />
            <h4 className="font-semibold text-sm">Óleo do Motor</h4>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Gauge className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-medium">Tipo:</span>
              <Badge variant="secondary" className="text-xs">{r.oilRecommendations.recommendedType}</Badge>
              <span className="text-xs font-medium">Capacidade:</span>
              <Badge variant="outline" className="text-xs">{r.oilRecommendations.capacity}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-medium">Intervalo:</span>
              <Badge variant="destructive" className="text-xs">{formatNumber(r.oilRecommendations.intervalKm)} km</Badge>
              <span className="text-xs text-muted-foreground">ou</span>
              <Badge variant="destructive" className="text-xs">
                {r.oilRecommendations.intervalMonths} {r.oilRecommendations.intervalMonths === 1 ? 'mês' : 'meses'}
              </Badge>
            </div>
            <BrandBadges brands={r.oilRecommendations.recommendedBrands} />
          </div>
          <Alert>
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            <AlertDescription className="text-xs">{r.oilRecommendations.description}</AlertDescription>
          </Alert>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />
            <h4 className="font-semibold text-sm">Pneus</h4>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Gauge className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-medium">Medida:</span>
              <Badge variant="secondary" className="text-xs font-mono">{r.tireRecommendations.recommendedSize}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-medium">Durabilidade:</span>
              <Badge variant="default" className="text-xs">~{formatNumber(r.tireRecommendations.intervalKm)} km</Badge>
            </div>
            <BrandBadges brands={r.tireRecommendations.recommendedBrands} />
          </div>
          <Alert>
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            <AlertDescription className="text-xs">{r.tireRecommendations.description}</AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
}
