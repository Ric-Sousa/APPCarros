import React, { useState } from 'react';
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
  Car, 
  DollarSign, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  Info,
  Fuel,
  Route,
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

interface TrafficData {
  routeOptimization: {
    fuelSavings: number;
    timeReduction: number;
    alternativeRoute: string;
  };
  congestionLevel: 'low' | 'medium' | 'high';
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
  maintenanceCosts: any;
  aiInsights: AIRecommendation[];
  summary: {
    totalPotentialSavings: number;
    urgentActions: number;
    nextRecommendedAction: string;
  };
}

export function EnhancedRecommendations({ vehicleId, location = "Porto" }: EnhancedRecommendationsProps) {
  const [activeTab, setActiveTab] = useState('summary');
  const { data: response, isLoading: loading, error: queryError, refetch } = useQuery<{ data: EnhancedRecommendationsData; demo?: boolean }>({
    queryKey: ['enhanced-recommendations', vehicleId, location],
    queryFn: () => get(`/api/external/enhanced-recommendations/${vehicleId}?location=${encodeURIComponent(location)}`),
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
            <TrendingUp className="h-5 w-5" />
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
            <AlertTriangle className="h-5 w-5" />
            Erro ao Carregar Recomendações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
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
          <TrendingUp className="h-5 w-5" />
                    Recomendações Inteligentes
          {isDemo && <Badge variant="outline">Dados de demonstração</Badge>}
        </CardTitle>
        <CardDescription>
          {isDemo
            ? 'Valores estimados/de referência — não são preços nem dados em tempo real'
            : 'Recomendações baseadas em APIs externas'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="summary">Resumo</TabsTrigger>
            <TabsTrigger value="fuel">Combustível</TabsTrigger>
            <TabsTrigger value="weather">Clima</TabsTrigger>
            <TabsTrigger value="ai">IA</TabsTrigger>
            <TabsTrigger value="costs">Custos</TabsTrigger>
          </TabsList>

          {/* Resumo */}
          <TabsContent value="summary" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    Poupança Potencial
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    €{data.summary.totalPotentialSavings.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">Por mês</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Ações Urgentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {data.summary.urgentActions}
                  </div>
                  <p className="text-xs text-muted-foreground">Requer atenção</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
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
                        <PriorityIcon className="h-4 w-4 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <TypeIcon className="h-4 w-4" />
                            <span className="font-semibold">{recommendation.title}</span>
                            <Badge variant={getPriorityColor(recommendation.priority) as any}>
                              {recommendation.priority}
                            </Badge>
                          </div>
                          <AlertDescription>
                            {recommendation.description}
                          </AlertDescription>
                          {recommendation.estimatedSavings && (
                            <div className="text-sm text-green-600 mt-1">
                              Poupança estimada: €{recommendation.estimatedSavings.toFixed(2)}
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
                    <Fuel className="h-5 w-5" />
                    Posto Mais Económico
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{data.fuelOptimization.cheapestStation.station}</span>
                      <Badge variant="outline">{data.fuelOptimization.cheapestStation.distance}km</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm">{data.fuelOptimization.cheapestStation.location}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <div className="font-medium">95</div>
                        <div className="text-muted-foreground">€{data.fuelOptimization.cheapestStation.gasoline95}</div>
                      </div>
                      <div>
                        <div className="font-medium">98</div>
                        <div className="text-muted-foreground">€{data.fuelOptimization.cheapestStation.gasoline98}</div>
                      </div>
                      <div>
                        <div className="font-medium">Diesel</div>
                        <div className="text-muted-foreground">€{data.fuelOptimization.cheapestStation.diesel}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-green-500" />
                    Poupança Potencial
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {data.fuelOptimization.potentialSavings.toFixed(1)}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Comparado ao posto mais caro
                  </p>
                </CardContent>
              </Card>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Recomendações de Combustível</h3>
              <div className="space-y-2">
                {data.fuelOptimization.recommendations.map((rec, index) => (
                  <Alert key={index}>
                    <Info className="h-4 w-4" />
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
                    <Cloud className="h-5 w-5" />
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
                      <span className="font-semibold capitalize">{data.weatherImpact.condition}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Impacto:</span>
                      <Badge variant={
                        data.weatherImpact.impact === 'high' ? 'destructive' :
                        data.weatherImpact.impact === 'medium' ? 'default' : 'secondary'
                      }>
                        {data.weatherImpact.impact}
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
                        <Cloud className="h-4 w-4" />
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
                        <TypeIcon className="h-5 w-5" />
                        {recommendation.title}
                        <Badge variant={getPriorityColor(recommendation.priority) as any}>
                          {recommendation.priority}
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
                            <div className="text-sm text-green-600">
                              <strong>Poupança: €{recommendation.estimatedSavings.toFixed(2)}</strong>
                            </div>
                          )}
                          {recommendation.deadline && (
                            <div className="text-sm text-orange-600">
                              <strong>Prazo: {new Date(recommendation.deadline).toLocaleDateString()}</strong>
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
                  <Wrench className="h-5 w-5" />
                  Preços de Manutenção
                </CardTitle>
                <CardDescription>
                  Comparação de preços em lojas próximas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Funcionalidade em desenvolvimento. Em breve, mostrará preços de óleos, 
                    pneus e outras peças em lojas próximas.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
