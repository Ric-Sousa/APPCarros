import { useState } from 'react';
import { formatDate, formatEuro, formatNumber } from '@/lib/utils';

const PRIORITY_LABEL: Record<string, string> = { urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa' };
const IMPACT_LABEL: Record<string, string> = { low: 'Baixo', medium: 'Médio', high: 'Alto' };
/** Condições do OpenWeather (em inglês) → pt-PT */
const conditionLabel = (c: string) => {
  const k = c.toLowerCase();
  if (k.includes('thunder')) return 'Trovoada';
  if (k.includes('drizzle')) return 'Chuvisco';
  if (k.includes('rain')) return 'Chuva';
  if (k.includes('snow')) return 'Neve';
  if (k.includes('cloud')) return 'Nublado';
  if (k.includes('clear')) return 'Céu limpo';
  if (/mist|fog|haze|smoke/.test(k)) return 'Nevoeiro';
  return c;
};

interface MaintenancePrices {
  oilPrices: { brand: string; type: string; price: number; shop: string }[];
  tirePrices: { brand: string; size: string; price: number; shop: string }[];
}
import { useQuery } from '@tanstack/react-query';
import { get, handleApiError } from '@/lib/apiUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
import { 
  TrendingUp, 
  TrendingDown, 
  MapPin, 
  Cloud, 
  DollarSign, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  Info,
  Fuel,
  Wrench
} from 'lucide-react';

interface EnhancedRecommendationsProps {
  vehicleId: string;
  location?: string;
}

interface FuelPriceData {
  station: string;
  location: string;
  gasoline95: number;
  gasoline98: number;
  diesel: number;
  distance: number;
  lastUpdated: string;
}

interface WeatherData {
  temperature: number;
  humidity: number;
  condition: string;
  impact: 'low' | 'medium' | 'high';
  recommendations: string[];
}


interface AIRecommendation {
  type: 'maintenance' | 'efficiency' | 'cost_saving' | 'safety';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  estimatedSavings?: number;
  actionRequired: string;
  deadline?: string;
}

interface EnhancedRecommendationsData {
  fuelOptimization: {
    cheapestStation: FuelPriceData;
    potentialSavings: number;
    recommendations: string[];
  };
  weatherImpact: WeatherData;
  maintenanceCosts: MaintenancePrices;
  aiInsights: AIRecommendation[];
  summary: {
    totalPotentialSavings: number;
    urgentActions: number;
    nextRecommendedAction: string;
  };
}

export function EnhancedRecommendations({ vehicleId, location }: EnhancedRecommendationsProps) {
  const [activeTab, setActiveTab] = useState('summary');
  const { data: response, isLoading: loading, error: queryError, refetch } = useQuery<{ data: EnhancedRecommendationsData; demo?: boolean }>({
    queryKey: ['enhanced-recommendations', vehicleId, location],
    queryFn: () => get(`/api/external/enhanced-recommendations/${vehicleId}${location ? `?location=${encodeURIComponent(location)}` : ''}`),
    enabled: !!vehicleId,
  });
  const data = response?.data ?? null;
  const isDemo = !!response?.demo;
  const error = !vehicleId ? 'ID do veículo não fornecido' : queryError ? handleApiError(queryError) : null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return AlertTriangle;
      case 'high': return AlertTriangle;
      case 'medium': return Info;
      case 'low': return CheckCircle;
      default: return Info;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'maintenance': return Wrench;
      case 'efficiency': return TrendingUp;
      case 'cost_saving': return DollarSign;
      case 'safety': return AlertTriangle;
      default: return Info;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
            Recomendações Inteligentes
          </CardTitle>
          <CardDescription>A carregar dados das APIs externas...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            Erro ao Carregar Recomendações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 space-x-2">
                        <Button onClick={() => refetch()}>
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" aria-hidden="true" />
                    Recomendações Inteligentes
          {isDemo && <Badge variant="outline">Dados de demonstração</Badge>}
        </CardTitle>
        <CardDescription>
          {isDemo
            ? 'Prazos calculados a partir dos dados do veículo; preços são valores de referência, não em tempo real'
            : 'Prazos calculados a partir dos dados do veículo e meteorologia em tempo real'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="summary" className="shrink-0">Resumo</TabsTrigger>
            <TabsTrigger value="fuel" className="shrink-0">Combustível</TabsTrigger>
            <TabsTrigger value="weather" className="shrink-0">Clima</TabsTrigger>
            <TabsTrigger value="ai" className="shrink-0">Ações</TabsTrigger>
            <TabsTrigger value="costs" className="shrink-0">Custos</TabsTrigger>
          </TabsList>

          {/* Resumo */}
          <TabsContent value="summary" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" aria-hidden="true" />
                    Poupança Potencial
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {data.summary.totalPotentialSavings > 0 ? formatEuro(data.summary.totalPotentialSavings) : '—'}
                  </div>
                  <p className="text-xs text-muted-foreground">{data.summary.totalPotentialSavings > 0 ? 'Por mês' : 'Sem estimativa'}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" aria-hidden="true" />
                    Ações Urgentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {data.summary.urgentActions}
                  </div>
                  <p className="text-xs text-muted-foreground">Requer atenção</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" aria-hidden="true" />
                    Próxima Ação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium truncate">
                    {data.summary.nextRecommendedAction}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3">Recomendações Prioritárias</h3>
              <div className="space-y-3">
                {data.aiInsights.slice(0, 3).map((recommendation, index) => {
                  const PriorityIcon = getPriorityIcon(recommendation.priority);
                  const TypeIcon = getTypeIcon(recommendation.type);
                  
                  return (
                    <Alert key={index}>
                      <div className="flex items-start gap-3">
                        <PriorityIcon className="h-4 w-4 mt-0.5" aria-hidden="true" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <TypeIcon className="h-4 w-4" aria-hidden="true" />
                            <span className="font-semibold">{recommendation.title}</span>
                            <Badge variant={getPriorityColor(recommendation.priority) as any}>
                              {PRIORITY_LABEL[recommendation.priority] ?? recommendation.priority}
                            </Badge>
                          </div>
                          <AlertDescription>
                            {recommendation.description}
                          </AlertDescription>
                          {recommendation.estimatedSavings && (
                            <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                              Poupança estimada: {formatEuro(recommendation.estimatedSavings)}
                            </div>
                          )}
                        </div>
                      </div>
                    </Alert>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* Combustível */}
          <TabsContent value="fuel" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Fuel className="h-5 w-5" aria-hidden="true" />
                    Posto Mais Económico
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{data.fuelOptimization.cheapestStation.station}</span>
                      <Badge variant="outline">{formatNumber(data.fuelOptimization.cheapestStation.distance, 1)} km</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" aria-hidden="true" />
                      <span className="text-sm">{data.fuelOptimization.cheapestStation.location}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <div className="font-medium">95</div>
                        <div className="text-muted-foreground">{formatNumber(data.fuelOptimization.cheapestStation.gasoline95, 3)} €</div>
                      </div>
                      <div>
                        <div className="font-medium">98</div>
                        <div className="text-muted-foreground">{formatNumber(data.fuelOptimization.cheapestStation.gasoline98, 3)} €</div>
                      </div>
                      <div>
                        <div className="font-medium">Gasóleo</div>
                        <div className="text-muted-foreground">{formatNumber(data.fuelOptimization.cheapestStation.diesel, 3)} €</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-green-500" aria-hidden="true" />
                    Poupança Potencial
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {formatNumber(data.fuelOptimization.potentialSavings, 1)}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Comparado com o posto mais caro (valores de referência)
                  </p>
                </CardContent>
              </Card>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Recomendações de Combustível</h3>
              <div className="space-y-2">
                {data.fuelOptimization.recommendations.map((rec, index) => (
                  <Alert key={index}>
                    <Info className="h-4 w-4" aria-hidden="true" />
                    <AlertDescription>{rec}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Clima */}
          <TabsContent value="weather" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cloud className="h-5 w-5" aria-hidden="true" />
                    Condições Atuais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Temperatura:</span>
                      <span className="font-semibold">{data.weatherImpact.temperature}°C</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Humidade:</span>
                      <span className="font-semibold">{data.weatherImpact.humidity}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Condição:</span>
                      <span className="font-semibold">{conditionLabel(data.weatherImpact.condition)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Impacto:</span>
                      <Badge variant={
                        data.weatherImpact.impact === 'high' ? 'destructive' :
                        data.weatherImpact.impact === 'medium' ? 'default' : 'secondary'
                      }>
                        {IMPACT_LABEL[data.weatherImpact.impact] ?? data.weatherImpact.impact}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recomendações Meteorológicas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.weatherImpact.recommendations.map((rec, index) => (
                      <Alert key={index}>
                        <Cloud className="h-4 w-4" aria-hidden="true" />
                        <AlertDescription>{rec}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* IA */}
          <TabsContent value="ai" className="space-y-4">
            <div className="space-y-4">
              {data.aiInsights.map((recommendation, index) => {
                const PriorityIcon = getPriorityIcon(recommendation.priority);
                const TypeIcon = getTypeIcon(recommendation.type);
                
                return (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TypeIcon className="h-5 w-5" aria-hidden="true" />
                        {recommendation.title}
                        <Badge variant={getPriorityColor(recommendation.priority) as any}>
                          {PRIORITY_LABEL[recommendation.priority] ?? recommendation.priority}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-3">
                        {recommendation.description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {recommendation.estimatedSavings && (
                            <div className="text-sm text-green-600 dark:text-green-400">
                              <strong>Poupança: {formatEuro(recommendation.estimatedSavings)}</strong>
                            </div>
                          )}
                          {recommendation.deadline && (
                            <div className="text-sm text-orange-600 dark:text-orange-400">
                              <strong>Prazo: {formatDate(recommendation.deadline)}</strong>
                            </div>
                          )}
                        </div>
                        <PriorityIcon className={`h-4 w-4 ${
                          recommendation.priority === 'urgent' ? 'text-red-500' :
                          recommendation.priority === 'high' ? 'text-orange-500' :
                          recommendation.priority === 'medium' ? 'text-yellow-500' : 'text-green-500'
                        }`} />
                      </div>
                      
                      <Alert className="mt-3">
                        <AlertDescription>
                          <strong>Ação recomendada:</strong> {recommendation.actionRequired}
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Custos */}
          <TabsContent value="costs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" aria-hidden="true" />
                  Preços de Manutenção
                </CardTitle>
                <CardDescription>
                  Valores de referência (não são preços em tempo real das lojas)
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">Óleo</h4>
                  <ul className="space-y-2 text-sm">
                    {data.maintenanceCosts.oilPrices.map((o) => (
                      <li key={o.brand + o.shop} className="flex justify-between gap-2">
                        <span>{o.brand} {o.type} <span className="text-muted-foreground">· {o.shop}</span></span>
                        <span className="font-medium">{formatEuro(o.price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Pneus</h4>
                  <ul className="space-y-2 text-sm">
                    {data.maintenanceCosts.tirePrices.map((t) => (
                      <li key={t.brand + t.shop} className="flex justify-between gap-2">
                        <span>{t.brand} {t.size} <span className="text-muted-foreground">· {t.shop}</span></span>
                        <span className="font-medium">{formatEuro(t.price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
