import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Battery, BatteryCharging, Loader2, MapPin, Route, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import ChargingStationReservationModal from './ChargingStationReservationModal';
import ChargingReservationsList from './ChargingReservationsList';
import { useToast } from '@/hooks/use-toast';
import { get, handleApiError } from '@/lib/apiUtils';
import { useDebounced } from '@/hooks/useVehicleSpecs';
import { formatNumber } from '@/lib/utils';

/** Posto devolvido por /api/charging-stations (OpenChargeMap). */
export interface ChargingStation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance: number;
  connectorTypes: string[];
  power: number;
  available: number;
  total: number;
  price: null;
  network: string;
  status: string;
  usageCost: string | null;
  access24Hours: boolean;
}

const LISBOA = { lat: 38.7223, lng: -9.1393 };

/** Estado do OpenChargeMap (em inglês) → texto e cor. */
function stationStatus(s: ChargingStation): [string, string] {
  const status = s.status.toLowerCase();
  if (/not operational|out of service|removed|faulty/.test(status)) return ['Fora de serviço', 'bg-muted text-muted-foreground'];
  if (s.available > 0) return [`Disponível (${s.available}/${s.total})`, 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'];
  if (/operational/.test(status)) return ['Operacional', 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'];
  return ['Estado desconhecido', 'bg-muted text-muted-foreground'];
}

/** Postos de carregamento próximos e carregamentos planeados (veículos elétricos). */
export default function ElectricVehicleHub({ vehicleId }: { vehicleId: string }) {
  const { toast } = useToast();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [radiusInput, setRadiusInput] = useState('25');
  const [selectedStation, setSelectedStation] = useState<ChargingStation | null>(null);

  const radius = Math.min(100, Math.max(5, Number(useDebounced(radiusInput, 500)) || 25));
  const center = location ?? LISBOA;
  const { data: stations = [], isFetching, error } = useQuery<ChargingStation[]>({
    queryKey: ['/api/charging-stations', center.lat, center.lng, radius],
    queryFn: () => get<ChargingStation[]>(`/api/charging-stations?lat=${center.lat}&lng=${center.lng}&radius=${radius}`),
    staleTime: 5 * 60 * 1000,
  });

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Este navegador não suporta geolocalização.');
      return;
    }
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ lat: coords.latitude, lng: coords.longitude });
        setLocating(false);
        toast({ title: 'Localização obtida', description: `Precisão de ±${Math.round(coords.accuracy)} m.` });
      },
      (err) => {
        setLocating(false);
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? 'Permissão de localização negada. Permita o acesso à localização no navegador.'
            : 'Não foi possível obter a localização. A mostrar postos perto de Lisboa.',
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BatteryCharging className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
            Carregamentos Planeados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChargingReservationsList vehicleId={vehicleId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <MapPin className="h-5 w-5" aria-hidden="true" />
              Postos de Carregamento Próximos
              {location && <Badge variant="outline" className="text-green-700 dark:text-green-400 border-current">GPS ativo</Badge>}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="ev-radius">Raio:</Label>
                <Input id="ev-radius" type="number" value={radiusInput} onChange={(e) => setRadiusInput(e.target.value)} className="w-20" min="5" max="100" />
                <span className="text-sm text-muted-foreground">km</span>
              </div>
              <Button onClick={getCurrentLocation} variant="outline" size="sm" disabled={locating}>
                {locating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> : <MapPin className="h-4 w-4 mr-2" aria-hidden="true" />}
                {locating ? 'A obter localização...' : location ? 'Atualizar localização' : 'Usar a minha localização'}
              </Button>
            </div>
          </div>
          {!location && !locationError && <p className="text-sm text-muted-foreground mt-2">A mostrar postos perto de Lisboa.</p>}
          {locationError && (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>{locationError}</AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent>
          {isFetching ? (
            <p className="text-center py-8 text-muted-foreground" role="status">A carregar postos de carregamento...</p>
          ) : error ? (
            <p className="text-center py-8 text-destructive">{handleApiError(error, 'Não foi possível carregar os postos.')}</p>
          ) : stations.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum posto de carregamento num raio de {radius} km.</p>
          ) : (
            <div className="space-y-4">
              {stations.map((station) => {
                const [statusText, statusClass] = stationStatus(station);
                return (
                  <div key={station.id} className="border border-border rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h4 className="font-medium break-words">{station.name}</h4>
                        <p className="text-sm text-muted-foreground break-words">{station.address}</p>
                      </div>
                      <Badge className={`${statusClass} shrink-0`}>{statusText}</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div><span className="text-muted-foreground">Distância:</span><div className="font-medium">{formatNumber(station.distance, 1)} km</div></div>
                      <div><span className="text-muted-foreground">Potência:</span><div className="font-medium">{station.power ? `${formatNumber(station.power)} kW` : '—'}</div></div>
                      <div><span className="text-muted-foreground">Preço:</span><div className="font-medium break-words">{station.usageCost || 'Não indicado'}</div></div>
                      <div><span className="text-muted-foreground">Rede:</span><div className="font-medium break-words">{station.network}</div></div>
                    </div>
                    {station.connectorTypes.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-sm text-muted-foreground">Conectores:</span>
                        {station.connectorTypes.map((type) => <Badge key={type} variant="outline" className="text-xs">{type}</Badge>)}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button size="sm" variant="outline" asChild>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}&travelmode=driving`} target="_blank" rel="noopener noreferrer">
                          <Route className="h-3 w-3 mr-1" aria-hidden="true" /> Direções
                        </a>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setSelectedStation(station)}>
                        <Battery className="h-3 w-3 mr-1" aria-hidden="true" /> Planear carregamento
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
            Dicas para Veículos Elétricos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Carregamento Inteligente</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                <li>Carregue durante a noite (tarifas mais baixas)</li>
                <li>Carregue até 80% no dia a dia para preservar a bateria</li>
                <li>Planeie rotas com postos de carregamento</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Maximizar Autonomia</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                <li>Pré-condicione o habitáculo enquanto carrega</li>
                <li>Use o modo ECO em cidade</li>
                <li>Mantenha a pressão correta dos pneus</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <ChargingStationReservationModal isOpen={!!selectedStation} onClose={() => setSelectedStation(null)} vehicleId={vehicleId} station={selectedStation} />
    </div>
  );
}
