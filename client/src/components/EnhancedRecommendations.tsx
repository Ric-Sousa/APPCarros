import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, LocateFixed, TrendingUp } from 'lucide-react';
import { get, handleApiError } from '@/lib/apiUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { ActionsTab, CostsTab, type EnhancedRecommendationsData, FuelTab, SummaryTab, WeatherTab } from './RecommendationTabs';

interface EnhancedRecommendationsProps {
  vehicleId: string;
  location?: string;
}

type Coords = { lat: number; lng: number };

export function EnhancedRecommendations({ vehicleId, location }: EnhancedRecommendationsProps) {
  const [activeTab, setActiveTab] = useState('summary');
  // Localização só quando o utilizador pede (sem pedir permissão ao abrir o separador)
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  const params = new URLSearchParams();
  if (coords) {
    params.set('lat', coords.lat.toFixed(4));
    params.set('lng', coords.lng.toFixed(4));
  } else if (location) params.set('location', location);
  const qs = params.toString();

  const { data: response, isLoading, error: queryError, refetch } = useQuery<{ data: EnhancedRecommendationsData; demo?: boolean }>({
    queryKey: ['enhanced-recommendations', vehicleId, qs],
    queryFn: () => get(`/api/external/enhanced-recommendations/${encodeURIComponent(vehicleId)}${qs ? `?${qs}` : ''}`),
    enabled: !!vehicleId,
  });
  const data = response?.data ?? null;
  const isDemo = !!response?.demo;
  const error = !vehicleId ? 'ID do veículo não fornecido' : queryError ? handleApiError(queryError) : null;

  const locate = () => {
    if (!navigator.geolocation) return setLocError('O navegador não permite obter a localização.');
    setLocating(true);
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocError('Não foi possível obter a localização.');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  };

  const title = (
    <CardTitle className="flex flex-wrap items-center gap-2">
      <TrendingUp className="h-5 w-5" aria-hidden="true" /> Recomendações Inteligentes
      {isDemo && <Badge variant="outline">Dados de demonstração</Badge>}
    </CardTitle>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          {title}
          <CardDescription>A carregar recomendações...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4" role="status" aria-label="A carregar">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" /> Erro ao carregar recomendações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error ?? 'Sem dados.'}</AlertDescription>
          </Alert>
          <Button className="mt-4" onClick={() => refetch()}>Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        {title}
        <CardDescription>
          {isDemo
            ? 'Prazos calculados a partir dos dados do veículo; preços são valores de referência, não em tempo real'
            : 'Prazos calculados a partir dos dados do veículo e meteorologia em tempo real'}
        </CardDescription>
        {!coords && (
          <div className="pt-2">
            <Button type="button" size="sm" variant="outline" onClick={locate} disabled={locating}>
              {locating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> : <LocateFixed className="h-4 w-4 mr-2" aria-hidden="true" />}
              Usar a minha localização
            </Button>
            {locError && <p className="mt-1 text-sm text-destructive" role="alert">{locError}</p>}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden">
            <TabsTrigger value="summary" className="shrink-0">Resumo</TabsTrigger>
            <TabsTrigger value="fuel" className="shrink-0">Combustível</TabsTrigger>
            <TabsTrigger value="weather" className="shrink-0">Clima</TabsTrigger>
            <TabsTrigger value="ai" className="shrink-0">Ações</TabsTrigger>
            <TabsTrigger value="costs" className="shrink-0">Custos</TabsTrigger>
          </TabsList>
          <TabsContent value="summary"><SummaryTab data={data} /></TabsContent>
          <TabsContent value="fuel"><FuelTab data={data} isDemo={isDemo} /></TabsContent>
          <TabsContent value="weather"><WeatherTab data={data} /></TabsContent>
          <TabsContent value="ai"><ActionsTab data={data} /></TabsContent>
          <TabsContent value="costs"><CostsTab data={data} /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
