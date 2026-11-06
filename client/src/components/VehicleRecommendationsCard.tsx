import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lightbulb, Gauge, Clock, Wrench, TrendingUp } from 'lucide-react';

interface VehicleRecommendationsCardProps {
  brand: string;
  model: string;
  onOilRecommendation?: (recommendations: string[]) => void;
  onTireRecommendation?: (recommendations: string[]) => void;
  onOilIntervalUpdate?: (intervalKm: number, intervalMonths: number) => void;
  onTireIntervalUpdate?: (intervalKm: number) => void;
}

// Recomendações estáticas temporárias para evitar erros de API
const getStaticRecommendations = (brand: string, model: string) => {
  // Base de dados básica de recomendações
  const recommendations = {
    found: false,
    oilRecommendations: {
      recommendedType: "5W-30",
      recommendedBrands: ["Castrol", "Mobil 1", "Shell", "Total", "Motul"],
      capacity: "4-6L (consulte manual)",
      intervalKm: 10000,
      intervalMonths: 12,
      description: "Troca a cada 10.000 km ou 12 meses (o que acontecer primeiro). Verifique o manual do proprietário para especificações exatas."
    },
    tireRecommendations: {
      recommendedSize: "Consulte manual do veículo",
      recommendedBrands: ["Michelin", "Continental", "Bridgestone", "Pirelli", "Dunlop"],
      intervalKm: 50000,
      description: "Substitua quando o pneu atingir 1.6mm de profundidade ou apresentar desgaste irregular. Duração média: 50.000 km."
    }
  };

  // Verificar se há recomendações específicas para marcas conhecidas
  const brandLower = brand.toLowerCase();
  if (brandLower.includes('bmw') || brandLower.includes('mercedes') || brandLower.includes('audi')) {
    recommendations.oilRecommendations.recommendedType = "5W-30 ou 0W-30";
    recommendations.oilRecommendations.intervalKm = 15000;
    recommendations.found = true;
  } else if (brandLower.includes('toyota') || brandLower.includes('honda')) {
    recommendations.oilRecommendations.recommendedType = "5W-30";
    recommendations.oilRecommendations.intervalKm = 10000;
    recommendations.found = true;
  } else if (brandLower.includes('volkswagen') || brandLower.includes('seat') || brandLower.includes('skoda')) {
    recommendations.oilRecommendations.recommendedType = "5W-30";
    recommendations.oilRecommendations.intervalKm = 15000;
    recommendations.found = true;
  }

  return recommendations;
};

interface VehicleRecommendationsCardProps {
  brand: string;
  model: string;
  onOilRecommendation?: (recommendations: string[]) => void;
  onTireRecommendation?: (recommendations: string[]) => void;
  onOilIntervalUpdate?: (intervalKm: number, intervalMonths: number) => void;
  onTireIntervalUpdate?: (intervalKm: number) => void;
}

export function VehicleRecommendationsCard({
  brand,
  model,
  onOilRecommendation,
  onTireRecommendation,
  onOilIntervalUpdate,
  onTireIntervalUpdate
}: VehicleRecommendationsCardProps) {
  const recommendations = getStaticRecommendations(brand, model);

  // Callbacks numa ref: o efeito só deve correr quando a marca/modelo mudam.
  // Com os callbacks nas dependências, um pai que os recria a cada render
  // (e faz setState neles) entrava num ciclo infinito de renderização.
  const callbacks = useRef({ onOilRecommendation, onTireRecommendation, onOilIntervalUpdate, onTireIntervalUpdate });
  callbacks.current = { onOilRecommendation, onTireRecommendation, onOilIntervalUpdate, onTireIntervalUpdate };

  useEffect(() => {
    if (!recommendations) return;
    const cb = callbacks.current;
    cb.onOilRecommendation?.(recommendations.oilRecommendations.recommendedBrands);
    cb.onTireRecommendation?.(recommendations.tireRecommendations.recommendedBrands);
    cb.onOilIntervalUpdate?.(recommendations.oilRecommendations.intervalKm, recommendations.oilRecommendations.intervalMonths);
    cb.onTireIntervalUpdate?.(recommendations.tireRecommendations.intervalKm);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recommendations deriva de brand/model
  }, [brand, model]);

  if (!brand || !model) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Recomendações para {brand} {model}
          {!recommendations.found && (
            <Badge variant="outline" className="text-xs">
              Genérica
            </Badge>
          )}
          {recommendations.found && (
            <Badge variant="default" className="text-xs bg-green-500">
              Específica
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Recomendações de Óleo */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-blue-500" />
            <h4 className="font-semibold text-sm">Óleo do Motor</h4>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Gauge className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium">Tipo:</span>
              <Badge variant="secondary" className="text-xs">
                {recommendations.oilRecommendations.recommendedType}
              </Badge>
              <span className="text-xs font-medium">Capacidade:</span>
              <Badge variant="outline" className="text-xs">
                {recommendations.oilRecommendations.capacity}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium">Intervalo:</span>
              <Badge variant="destructive" className="text-xs">
                {recommendations.oilRecommendations.intervalKm.toLocaleString()} km
              </Badge>
              <span className="text-xs text-muted-foreground">ou</span>
              <Badge variant="destructive" className="text-xs">
                {recommendations.oilRecommendations.intervalMonths} {recommendations.oilRecommendations.intervalMonths === 1 ? 'mês' : 'meses'}
              </Badge>
            </div>
            
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="text-xs text-muted-foreground mr-2">Marcas recomendadas:</span>
              {recommendations.oilRecommendations.recommendedBrands.slice(0, 4).map((brandName: string, index: number) => (
                <Badge key={index} variant="default" className="text-xs">
                  {brandName}
                </Badge>
              ))}
            </div>
          </div>
          
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {recommendations.oilRecommendations.description}
            </AlertDescription>
          </Alert>
        </div>

        {/* Recomendações de Pneus */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <h4 className="font-semibold text-sm">Pneus</h4>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Gauge className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium">Medida:</span>
              <Badge variant="secondary" className="text-xs font-mono">
                {recommendations.tireRecommendations.recommendedSize}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium">Durabilidade:</span>
              <Badge variant="default" className="text-xs">
                ~{recommendations.tireRecommendations.intervalKm.toLocaleString()} km
              </Badge>
            </div>
            
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="text-xs text-muted-foreground mr-2">Marcas recomendadas:</span>
              {recommendations.tireRecommendations.recommendedBrands.slice(0, 4).map((brandName: string, index: number) => (
                <Badge key={index} variant="default" className="text-xs">
                  {brandName}
                </Badge>
              ))}
            </div>
          </div>
          
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {recommendations.tireRecommendations.description}
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
}
