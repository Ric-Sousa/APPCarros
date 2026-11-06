import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import ChargingStationReservationModal from './ChargingStationReservationModal';
import EVComparisonCalculator from './EVComparisonCalculator';
import { 
  Zap, 
  Battery, 
  MapPin, 
  Calculator, 
  TrendingDown,
  TrendingUp,
  Leaf,
  Euro,
  Clock,
  Route
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { get, post } from '@/lib/apiUtils';

interface ChargingStation {
  id: string;
  name: string;
  address: string;
  distance: number;
  power: number; // kW
  connectorTypes: string[];
  price: number; // €/kWh
  availability: 'available' | 'occupied' | 'out_of_service';
  network: string;
  lat?: number; // Optional latitude
  lng?: number; // Optional longitude
}


interface ElectricVehicleHubProps {
  vehicleId?: string;
  userLocation?: { lat: number; lng: number };
}

const ElectricVehicleHub: React.FC<ElectricVehicleHubProps> = ({ 
  vehicleId, 
  userLocation: providedLocation
}) => {
  const [chargingStations, setChargingStations] = useState<ChargingStation[]>([]);
  const [isLoadingStations, setIsLoadingStations] = useState(false);
  const [searchRadius, setSearchRadius] = useState<number>(25); // km
  const [radiusInput, setRadiusInput] = useState<string>('25'); // For controlled input
  const [userCurrentLocation, setUserCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [isGettingLocation, setIsGettingLocation] = useState<boolean>(false);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<ChargingStation | null>(null);

  // Debounce searchRadius updates
  useEffect(() => {
    const timeout = setTimeout(() => {
      const newRadius = Number(radiusInput);
      if (newRadius >= 5 && newRadius <= 100 && newRadius !== searchRadius) {
        setSearchRadius(newRadius);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeout);
  }, [radiusInput, searchRadius]);
  const { toast } = useToast();

  // Get user's current location with multiple precision attempts
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalização não é suportada neste navegador');
      toast({
        title: "Geolocalização indisponível",
        description: "O seu navegador não suporta geolocalização",
        variant: "destructive"
      });
      return;
    }

    setIsGettingLocation(true);
    setLocationError('');
    
    // Strategy 1: Try watchPosition for real-time updates (most accurate)
    let watchId: number;
    let timeoutId: NodeJS.Timeout;
    let gotLocation = false;

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (gotLocation) return; // Already got a location
        
        const { latitude, longitude, accuracy } = position.coords;
        const timestamp = position.timestamp;
        const age = Date.now() - timestamp;
        
        // Accept location if accuracy is good enough or after some time
        if (accuracy <= 100 || age < 10000) { // Accept if within 100m or fresh reading
          gotLocation = true;
          navigator.geolocation.clearWatch(watchId);
          clearTimeout(timeoutId);
          
          setUserCurrentLocation({ lat: latitude, lng: longitude });
          setIsGettingLocation(false);
          
          toast({
            title: "Localização GPS obtida",
            description: `Localização precisa (±${Math.round(accuracy)}m). A recarregar postos próximos...`,
          });
          
          // Auto-reload stations when location changes
          setTimeout(() => {
            loadNearbyChargingStations();
          }, 500);
        }
      },
      (error) => {
        navigator.geolocation.clearWatch(watchId);
        clearTimeout(timeoutId);
        
        if (!gotLocation) {
          
          navigator.geolocation.getCurrentPosition(
            (position) => {
              if (gotLocation) return;
              gotLocation = true;
              
              const { latitude, longitude, accuracy } = position.coords;

              setUserCurrentLocation({ lat: latitude, lng: longitude });
              setIsGettingLocation(false);
              
              toast({
                title: "Localização obtida",
                description: `Localização (±${Math.round(accuracy)}m). A recarregar postos próximos...`,
              });
              
              setTimeout(() => {
                loadNearbyChargingStations();
              }, 500);
            },
            (fallbackError) => {
              
              // Strategy 3: Final fallback with lower accuracy
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  if (gotLocation) return;
                  gotLocation = true;
                  
                  const { latitude, longitude, accuracy } = position.coords;
                  
                  setUserCurrentLocation({ lat: latitude, lng: longitude });
                  setIsGettingLocation(false);
                  
                  toast({
                    title: "Localização aproximada",
                    description: `Localização obtida (±${Math.round(accuracy)}m). A recarregar postos próximos...`,
                  });
                  
                  setTimeout(() => {
                    loadNearbyChargingStations();
                  }, 500);
                },
                (finalError) => {
                  setIsGettingLocation(false);
                  
                  let errorMessage = '';
                  switch (finalError.code) {
                    case finalError.PERMISSION_DENIED:
                      errorMessage = 'Permissão de localização negada. Por favor, permita o acesso à localização e recarregue a página.';
                      break;
                    case finalError.POSITION_UNAVAILABLE:
                      errorMessage = 'Localização indisponível. Verifique se o GPS/Wi-Fi estão ativos.';
                      break;
                    case finalError.TIMEOUT:
                      errorMessage = 'Timeout na obtenção da localização. Tente novamente.';
                      break;
                    default:
                      errorMessage = 'Erro na geolocalização. A usar localização padrão.';
                      break;
                  }
                  setLocationError(errorMessage);
                  toast({
                    title: "Erro de localização",
                    description: errorMessage,
                    variant: "destructive"
                  });
                },
                {
                  enableHighAccuracy: false,
                  timeout: 10000,
                  maximumAge: 600000 // 10 minutes for final fallback
                }
              );
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 120000 // 2 minutes
            }
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000, // 20 seconds for GPS
        maximumAge: 30000 // 30 seconds fresh data
      }
    );
    
    // Timeout for watch position
    timeoutId = setTimeout(() => {
      if (!gotLocation) {
        navigator.geolocation.clearWatch(watchId);
        // The error callback above will handle the fallback
      }
    }, 25000); // 25 second timeout for watch
  };

  // Try to get user location on component mount
  useEffect(() => {
    if (!providedLocation && !userCurrentLocation) {
      getCurrentLocation();
    }
  }, [providedLocation, userCurrentLocation]);

  // Memoize userLocation to prevent unnecessary re-renders
  const userLocation = useMemo(() => {
    if (providedLocation) return providedLocation;
    if (userCurrentLocation) return userCurrentLocation;
    
    // Show warning for default location
    if (!locationError) {
    }
    
    // Use Lisboa as fallback (better charging station coverage)
    return { lat: 38.7223, lng: -9.1393 }; // Lisboa - good charging station coverage
  }, [providedLocation, userCurrentLocation, locationError]);

  const loadNearbyChargingStations = async () => {
    if (isLoadingStations) return; // Prevent multiple simultaneous calls
    
    setIsLoadingStations(true);
    try {
      const response = await get(
        `/api/charging-stations?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=${searchRadius}`
      );
      
      // Ensure we always have an array
      const stations = Array.isArray(response) ? response : [];
      
      setChargingStations(stations);
      
      if (stations.length === 0) {
        toast({
          title: "Nenhum posto encontrado",
          description: `Não há postos de carregamento dentro de ${searchRadius}km. Tente aumentar o raio de pesquisa.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao carregar postos",
        description: "Não foi possível carregar os postos de carregamento próximos.",
        variant: "destructive"
      });
      setChargingStations([]);
    } finally {
      setIsLoadingStations(false);
    }
  };


  useEffect(() => {
    loadNearbyChargingStations();
  }, [searchRadius, userLocation.lat, userLocation.lng]); // Reload when location or radius changes


  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'occupied': return 'bg-red-100 text-red-800';
      case 'out_of_service': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAvailabilityText = (availability: string) => {
    switch (availability) {
      case 'available': return 'Disponível';
      case 'occupied': return 'Ocupado';
      case 'out_of_service': return 'Fora de Serviço';
      default: return 'Desconhecido';
    }
  };

  const openDirections = (station: ChargingStation) => {
    // Use most accurate location available - prioritize GPS
    let currentLocation: { lat: number; lng: number };
    let locationSource = '';
    
    if (userCurrentLocation) {
      currentLocation = userCurrentLocation;
      locationSource = 'GPS atual';
    } else if (providedLocation) {
      currentLocation = providedLocation;
      locationSource = 'localização fornecida';
    } else {
      currentLocation = userLocation;
      locationSource = 'localização padrão';
    }
    
    const { lat, lng } = currentLocation;

    let destination = '';
    let originCoords = `${lat},${lng}`;
    
    if (station.lat && station.lng) {
      destination = `${station.lat},${station.lng}`;
    } else {
      destination = encodeURIComponent(station.address);
    }
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let directionsUrl = '';
    
    if (isIOS) {
      if (station.lat && station.lng) {
        directionsUrl = `maps://maps.apple.com/?saddr=${originCoords}&daddr=${station.lat},${station.lng}&dirflg=d`;
      } else {
        directionsUrl = `maps://maps.apple.com/?saddr=${originCoords}&daddr=${encodeURIComponent(station.address)}&dirflg=d`;
      }
    } else if (isAndroid) {
      // Use Google Maps on Android with precise coordinates
      directionsUrl = `google.navigation:q=${destination}&origin=${originCoords}`;
    } else {
      // Use Google Maps web for desktop/other devices with precise origin
      directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originCoords}&destination=${destination}&travelmode=driving`;
    }
    
    try {
      // Try to open native app first
      const link = document.createElement('a');
      link.href = directionsUrl;
      link.target = '_blank'; // Ensure it opens properly
      link.click();
      
      toast({
        title: "Direções abertas",
        description: `Direções da sua ${locationSource} para ${station.name}.`,
      });
    } catch (error) {
      
      // Fallback to Google Maps web if native apps fail
      const fallbackUrl = `https://www.google.com/maps/dir/?api=1&origin=${originCoords}&destination=${destination}&travelmode=driving`;
      window.open(fallbackUrl, '_blank');
      
      toast({
        title: "Direções abertas",
        description: `As direções foram abertas no Google Maps usando a sua ${locationSource}.`,
      });
    }
  };

  const reserveStation = (station: ChargingStation) => {
    if (!vehicleId) {
      toast({
        title: "Veículo não selecionado",
        description: "Por favor, selecione um veículo para fazer a reserva.",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedStation(station);
    setIsReservationModalOpen(true);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-600" />
            Centro de Veículos Elétricos
          </CardTitle>
        </CardHeader>
      </Card>

      {/* EV Comparison Calculator */}
      {vehicleId && <EVComparisonCalculator vehicleId={vehicleId} />}

      {/* Nearby Charging Stations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Postos de Carregamento Próximos
              {userCurrentLocation && (
                <Badge variant="outline" className="ml-2 text-green-600 border-green-600">
                  GPS Ativo
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label>Raio:</Label>
                <Input
                  type="number"
                  value={radiusInput}
                  onChange={(e) => setRadiusInput(e.target.value)}
                  className="w-20"
                  min="5"
                  max="100"
                />
                <span className="text-sm text-gray-500">km</span>
              </div>
              <Button 
                onClick={getCurrentLocation} 
                variant="outline" 
                size="sm"
                disabled={isGettingLocation}
                className="flex items-center gap-2"
              >
                {isGettingLocation ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    A obter localização...
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4" />
                    {userCurrentLocation ? 'Atualizar GPS' : 'Obter Localização'}
                  </>
                )}
              </Button>
            </div>
          </div>
          {userCurrentLocation && (
            <div className="mt-2 text-sm text-green-600 bg-green-50 p-2 rounded">
              📍 Localização atual: {userCurrentLocation.lat.toFixed(4)}, {userCurrentLocation.lng.toFixed(4)}
            </div>
          )}
          {locationError && (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>{locationError}</AlertDescription>
            </Alert>
          )}
          {userCurrentLocation && (
            <div className="text-sm text-green-600 mt-2">
              ✓ Localização atual detetada: {userCurrentLocation.lat.toFixed(4)}, {userCurrentLocation.lng.toFixed(4)}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoadingStations ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                A carregar postos de carregamento...
              </div>
            </div>
          ) : !Array.isArray(chargingStations) || chargingStations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhum posto de carregamento encontrado num raio de {searchRadius}km.
            </div>
          ) : (
            <div className="space-y-4">
              {Array.isArray(chargingStations) && chargingStations.map((station) => (
              <div key={station.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium">{station.name}</h4>
                    <p className="text-sm text-gray-600">{station.address}</p>
                  </div>
                  <Badge className={getAvailabilityColor(station.availability)}>
                    {getAvailabilityText(station.availability)}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Distância:</span>
                    <div className="font-medium">{station.distance} km</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Potência:</span>
                    <div className="font-medium">{station.power} kW</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Preço:</span>
                    <div className="font-medium">€{station.price}/kWh</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Rede:</span>
                    <div className="font-medium">{station.network}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-gray-500">Conectores:</span>
                  {station.connectorTypes.map((type) => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                </div>
                
                <div className="flex gap-2 mt-3">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => openDirections(station)}
                  >
                    <Route className="h-3 w-3 mr-1" />
                    Direções
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => reserveStation(station)}
                  >
                    <Battery className="h-3 w-3 mr-1" />
                    Reservar
                  </Button>
                </div>
              </div>
            ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* EV Tips and Information */}
      <Card>
        <CardHeader>
          <CardTitle>Dicas para Veículos Elétricos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Carregamento Inteligente</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Carregue durante a noite (tarifas mais baixas)</li>
                <li>• Use carregamento lento (80%) para preservar bateria</li>
                <li>• Planeie rotas com postos de carregamento</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Maximizar Autonomia</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Pré-condicione o habitáculo enquanto carrega</li>
                <li>• Use modo ECO em cidade</li>
                <li>• Mantenha pressão correta dos pneus</li>
              </ul>
            </div>
        </div>
          </CardContent>
        </Card>
      
      <ChargingStationReservationModal
        isOpen={isReservationModalOpen}
        onClose={() => {
          setIsReservationModalOpen(false);
          setSelectedStation(null);
        }}
        vehicleId={vehicleId || ''}
        station={selectedStation}
      />
    </div>
  );
};

export default ElectricVehicleHub;
