import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { MapPin, Star, Navigation, Euro, Fuel, Clock, Phone } from 'lucide-react';

interface FuelStation {
  id: string;
  name: string;
  brand: string;
  address: string;
  distance: number;
  rating: number;
  prices: {
    gasoline95: number;
    gasoline98: number;
    diesel: number;
  };
  amenities: string[];
  openingHours: string;
  phone?: string;
  lastUpdated: string;
}

const FuelStationComparator: React.FC = () => {
  const [location, setLocation] = useState<string>('');
  const [fuelType, setFuelType] = useState<string>('gasoline95');
  const [radius, setRadius] = useState<number>(10);
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [loading, setLoading] = useState(false);

  // Helpers to fetch real data from OpenStreetMap (Nominatim for geocoding + Overpass for stations)
  const getBrandColor = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'bp': return 'bg-green-500';
      case 'galp': return 'bg-orange-500';
      case 'repsol': return 'bg-red-500';
      case 'cepsa': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  // Haversine distance (km)
  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (v: number) => v * Math.PI / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Geocode user input using Nominatim
  const geocodeLocation = async (q: string) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'pt' } });
    if (!res.ok) throw new Error('Geocoding failed');
    const data = await res.json();
    if (!data || data.length === 0) throw new Error('Localização não encontrada');
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  };

  // Fetch fuel stations from Overpass API around lat/lon within radiusMeters
  const fetchOverpassStations = async (lat: number, lon: number, radiusMeters: number) => {
    // Overpass QL: nodes and ways with amenity=fuel
    const query = `[out:json][timeout:25];(
  node["amenity"="fuel"](around:${radiusMeters},${lat},${lon});
  way["amenity"="fuel"](around:${radiusMeters},${lat},${lon});
  relation["amenity"="fuel"](around:${radiusMeters},${lat},${lon});
);out center tags;`;

    const url = 'https://overpass-api.de/api/interpreter';
    const res = await fetch(url, { method: 'POST', body: query });
    if (!res.ok) throw new Error('Overpass request failed');
    const json = await res.json();
    return json.elements || [];
  };

  const parseOverpassElement = (el: any, originLat: number, originLon: number): FuelStation => {
    const lat = el.lat ?? (el.center && el.center.lat) ?? 0;
    const lon = el.lon ?? (el.center && el.center.lon) ?? 0;
    const tags = el.tags || {};
    const name = tags.name || tags.brand || 'Posto de Combustível';
    const addressParts = [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']].filter(Boolean);
    const address = addressParts.join(', ') || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    const brand = (tags.brand || tags.operator || '').toString();

    // Try to parse prices from tags if present (not common)
    const parsePrice = (v: any) => {
      if (!v) return undefined;
      const n = parseFloat(String(v).replace(',', '.'));
      return Number.isFinite(n) ? n : undefined;
    };

    const prices = {
      gasoline95: parsePrice(tags['fuel:octane_95']) ?? parsePrice(tags['price:gasoline_95']) ?? undefined,
      gasoline98: parsePrice(tags['fuel:octane_98']) ?? parsePrice(tags['price:gasoline_98']) ?? undefined,
      diesel: parsePrice(tags['fuel:diesel']) ?? parsePrice(tags['price:diesel']) ?? undefined,
    };

    const amenities: string[] = [];
    if (tags.shop) amenities.push(tags.shop);
    if (tags.car_wash === 'yes') amenities.push('Lavagem Auto');
    if (tags.cafe === 'yes' || tags['amenity:cafe']) amenities.push('Café');
    if (tags.toilets === 'yes' || tags['toilets:customers'] === 'yes') amenities.push('WC');

    const openingHours = tags.opening_hours || 'Desconhecido';

    const phone = tags.phone || tags['contact:phone'] || undefined;

    const distance = haversineDistance(originLat, originLon, lat, lon);

    return {
      id: `${el.type}/${el.id}`,
      name,
      brand: brand || 'Independente',
      address,
      distance: Number(distance.toFixed(2)),
      rating: tags['rating'] ? parseFloat(tags['rating']) : 0,
      prices: {
        gasoline95: prices.gasoline95 ?? NaN,
        gasoline98: prices.gasoline98 ?? NaN,
        diesel: prices.diesel ?? NaN,
      },
      amenities,
      openingHours,
      phone,
      lastUpdated: new Date().toISOString(),
    };
  };

  const searchStations = async () => {
    if (!location.trim()) {
      alert('Por favor, insira uma localização.');
      return;
    }

    setLoading(true);
    try {
      const { lat, lon } = await geocodeLocation(location);
      const elements = await fetchOverpassStations(lat, lon, radius * 1000);

      const parsed: FuelStation[] = elements.map((el: any) => parseOverpassElement(el, lat, lon));

      // Sort: prefer stations with price for selected fuelType, otherwise by distance
      const withPrice = parsed.filter(s => !isNaN(getFuelPrice(s, fuelType) ?? NaN));
      const withoutPrice = parsed.filter(s => isNaN(getFuelPrice(s, fuelType) ?? NaN));

      withPrice.sort((a, b) => (getFuelPrice(a, fuelType) as number) - (getFuelPrice(b, fuelType) as number));
      withoutPrice.sort((a, b) => a.distance - b.distance);

      const result = [...withPrice, ...withoutPrice];
      setStations(result);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao procurar postos');
    } finally {
      setLoading(false);
    }
  };

  const getFuelPrice = (station: FuelStation, type: string) => {
    const val = (() => {
      switch (type) {
        case 'gasoline95': return station.prices.gasoline95;
        case 'gasoline98': return station.prices.gasoline98;
        case 'diesel': return station.prices.diesel;
        default: return station.prices.gasoline95;
      }
    })();
    // If NaN or undefined -> return undefined
    return Number.isFinite(val) ? val : undefined;
  };

  const getFuelTypeLabel = (type: string) => {
    switch (type) {
      case 'gasoline95': return 'Gasolina 95';
      case 'gasoline98': return 'Gasolina 98';
      case 'diesel': return 'Gasóleo';
      default: return 'Gasolina 95';
    }
  };

  const calculateSavings = (currentPrice: number, cheapestPrice: number, liters: number = 50) => {
    return ((currentPrice - cheapestPrice) * liters).toFixed(2);
  };

  // Compute cheapest price among stations that have a defined price for selected fuelType
  const pricesList = stations.map(s => getFuelPrice(s, fuelType)).filter((p): p is number => typeof p === 'number');
  const cheapestPrice = pricesList.length > 0 ? Math.min(...pricesList) : undefined;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Comparador de Postos de Combustível
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Localização</Label>
              <Input
                id="location"
                placeholder="Ex: Lisboa, Rua..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fuel-type">Tipo de Combustível</Label>
              <Select value={fuelType} onValueChange={setFuelType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gasoline95">Gasolina 95</SelectItem>
                  <SelectItem value="gasoline98">Gasolina 98</SelectItem>
                  <SelectItem value="diesel">Gasóleo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="radius">Raio de Pesquisa (km)</Label>
              <Select value={radius.toString()} onValueChange={(value) => setRadius(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 km</SelectItem>
                  <SelectItem value="10">10 km</SelectItem>
                  <SelectItem value="15">15 km</SelectItem>
                  <SelectItem value="20">20 km</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={searchStations} className="w-full" disabled={loading}>
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Procurando postos...
              </div>
            ) : (
              <>
                <Navigation className="h-4 w-4 mr-2" />
                Procurar Postos
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {stations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {stations.length} postos encontrados para {getFuelTypeLabel(fuelType)}
            </h3>
            <Badge variant="outline" className="text-green-600">
              Ordenado por preço
            </Badge>
          </div>

          <div className="grid gap-4">
            {stations.map((station, index) => {
              const price = getFuelPrice(station, fuelType);
              const isLowest = typeof price === 'number' && typeof cheapestPrice === 'number' && price === cheapestPrice;
              const savings = (typeof price === 'number' && typeof cheapestPrice === 'number') ? calculateSavings(price, cheapestPrice) : undefined;

              return (
                <Card key={station.id} className={`${isLowest ? 'ring-2 ring-green-500 bg-green-50' : ''}`}>
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row justify-between gap-4">
                      {/* Station Info */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${getBrandColor(station.brand)}`}></div>
                          <h4 className="font-semibold text-lg">{station.name}</h4>
                          {isLowest && <Badge className="bg-green-500">Mais Barato</Badge>}
                          {index === 0 && !isLowest && <Badge variant="secondary">Mais Próximo</Badge>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{station.address}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Navigation className="h-4 w-4" />
                            <span>{station.distance} km</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>{station.openingHours}</span>
                          </div>
                          {station.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              <span>{station.phone}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          <span className="text-sm font-medium">{station.rating}</span>
                          <span className="text-xs text-gray-500">
                            • Atualizado: {new Date(station.lastUpdated).toLocaleString('pt-PT')}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {station.amenities.map((amenity, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {amenity}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Price Info */}
                      <div className="flex flex-col items-end justify-center space-y-2 lg:min-w-[200px]">
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <Euro className="h-5 w-5 text-green-600" />
                            <span className="text-2xl font-bold text-green-600">
                              {typeof price === 'number' ? price.toFixed(3) : 'N/D'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">por litro</p>
                        </div>

                        {!isLowest && savings !== undefined && (
                          <div className="text-right text-sm">
                            <p className="text-red-600 font-medium">
                              +€{savings} mais caro
                            </p>
                            <p className="text-gray-500">(por 50L)</p>
                          </div>
                        )}

                        {isLowest && (
                          <div className="text-right text-sm">
                            <p className="text-green-600 font-medium">Melhor preço!</p>
                            <p className="text-gray-500">Poupa até €{(typeof cheapestPrice === 'number' ? calculateSavings(Math.max(...stations.map(s => getFuelPrice(s, fuelType)).filter((v): v is number => typeof v === 'number')), cheapestPrice) : 'N/D')}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <p className="text-gray-500">95</p>
                            <p className="font-medium">{Number.isFinite(station.prices.gasoline95) ? `€${station.prices.gasoline95.toFixed(3)}` : 'N/D'}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-500">98</p>
                            <p className="font-medium">{Number.isFinite(station.prices.gasoline98) ? `€${station.prices.gasoline98.toFixed(3)}` : 'N/D'}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-500">Diesel</p>
                            <p className="font-medium">{Number.isFinite(station.prices.diesel) ? `€${station.prices.diesel.toFixed(3)}` : 'N/D'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FuelStationComparator;
