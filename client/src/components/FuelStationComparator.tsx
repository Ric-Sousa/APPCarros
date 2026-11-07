import { useState } from 'react';
import { Clock, Euro, Loader2, MapPin, Navigation, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';
import { get, handleApiError } from '@/lib/apiUtils';
import { formatEuro, formatNumber } from '@/lib/utils';

type PriceKey = 'gasoline95' | 'gasoline98' | 'diesel';
const FUEL_LABEL: Record<PriceKey, string> = { gasoline95: 'Gasolina 95', gasoline98: 'Gasolina 98', diesel: 'Gasóleo' };

interface FuelStation {
  id: string;
  name: string;
  brand: string;
  address: string;
  distance: number;
  prices: Partial<Record<PriceKey, number>>;
  amenities: string[];
  openingHours?: string;
  phone?: string;
}

const toRad = (v: number) => (v * Math.PI) / 180;
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const price = (v: unknown) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/** Postos do OpenStreetMap (Overpass) perto de uma morada. Os preços só aparecem quando o OSM os tem. */
function parseStation(el: any, lat: number, lon: number): FuelStation {
  const sLat = el.lat ?? el.center?.lat ?? 0;
  const sLon = el.lon ?? el.center?.lon ?? 0;
  const t = el.tags ?? {};
  const amenities: string[] = [];
  if (t.shop) amenities.push('Loja');
  if (t.car_wash === 'yes') amenities.push('Lavagem auto');
  if (t.cafe === 'yes' || t['amenity:cafe']) amenities.push('Café');
  if (t.toilets === 'yes' || t['toilets:customers'] === 'yes') amenities.push('WC');
  return {
    id: `${el.type}/${el.id}`,
    name: t.name || t.brand || 'Posto de Combustível',
    brand: String(t.brand || t.operator || 'Independente'),
    address: [t['addr:street'], t['addr:housenumber'], t['addr:city']].filter(Boolean).join(', ') || `${sLat.toFixed(5)}, ${sLon.toFixed(5)}`,
    distance: Number(haversineKm(lat, lon, sLat, sLon).toFixed(2)),
    prices: {
      gasoline95: price(t['price:gasoline_95'] ?? t['fuel:octane_95:price']),
      gasoline98: price(t['price:gasoline_98'] ?? t['fuel:octane_98:price']),
      diesel: price(t['price:diesel'] ?? t['fuel:diesel:price']),
    },
    amenities,
    openingHours: t.opening_hours,
    phone: t.phone || t['contact:phone'],
  };
}

export default function FuelStationComparator() {
  const { toast } = useToast();
  const [location, setLocation] = useState('');
  const [fuelType, setFuelType] = useState<PriceKey>('gasoline95');
  const [radius, setRadius] = useState(10);
  const [stations, setStations] = useState<FuelStation[] | null>(null);
  const [loading, setLoading] = useState(false);

  const searchStations = async () => {
    if (!location.trim()) {
      toast({ title: 'Indique uma localização', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { results } = await get<{ results: { lat: number; lng: number }[] }>(`/api/geocode?q=${encodeURIComponent(location)}`);
      const place = results[0];
      if (!place) throw new Error('Localização não encontrada');
      const r = radius * 1000;
      const query = `[out:json][timeout:25];nwr["amenity"="fuel"](around:${r},${place.lat},${place.lng});out center tags;`;
      const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query });
      if (!res.ok) throw new Error('O serviço de mapas não respondeu. Tente novamente.');
      const elements: any[] = (await res.json()).elements ?? [];
      const parsed = elements.map((el) => parseStation(el, place.lat, place.lng));
      // Com preço primeiro (do mais barato), depois os restantes por distância
      parsed.sort((a, b) => (a.prices[fuelType] ?? Infinity) - (b.prices[fuelType] ?? Infinity) || a.distance - b.distance);
      setStations(parsed);
    } catch (err) {
      toast({ title: 'Erro ao procurar postos', description: handleApiError(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const withPrice = (stations ?? []).map((s) => s.prices[fuelType]).filter((p): p is number => p !== undefined);
  const cheapest = withPrice.length ? Math.min(...withPrice) : undefined;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" aria-hidden="true" /> Comparador de Postos de Combustível</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="station-location">Localização</Label>
              <Input id="station-location" placeholder="Ex.: Lisboa, Rua..." value={location} onChange={(e) => setLocation(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchStations()} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="station-fuel">Tipo de Combustível</Label>
              <Select value={fuelType} onValueChange={(v) => setFuelType(v as PriceKey)}>
                <SelectTrigger id="station-fuel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FUEL_LABEL) as PriceKey[]).map((k) => <SelectItem key={k} value={k}>{FUEL_LABEL[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="station-radius">Raio de Pesquisa</Label>
              <Select value={String(radius)} onValueChange={(v) => setRadius(Number(v))}>
                <SelectTrigger id="station-radius"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20].map((km) => <SelectItem key={km} value={String(km)}>{km} km</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={searchStations} className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> : <Navigation className="h-4 w-4 mr-2" aria-hidden="true" />}
            {loading ? 'A procurar postos...' : 'Procurar Postos'}
          </Button>
          <p className="text-xs text-muted-foreground">Dados do OpenStreetMap. Os preços só aparecem quando estão registados no mapa.</p>
        </CardContent>
      </Card>

      {stations && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{stations.length} postos encontrados — {FUEL_LABEL[fuelType]}</h3>
          {stations.map((station) => {
            const p = station.prices[fuelType];
            const isLowest = p !== undefined && p === cheapest;
            return (
              <Card key={station.id} className={isLowest ? 'ring-2 ring-green-500' : ''}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row justify-between gap-4">
                    <div className="flex-1 space-y-3 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-lg break-words">{station.name}</h4>
                        <Badge variant="outline">{station.brand}</Badge>
                        {isLowest && <Badge className="bg-green-600 text-white">Mais barato</Badge>}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" aria-hidden="true" /> <span className="break-words">{station.address}</span></div>
                        <div className="flex items-center gap-2"><Navigation className="h-4 w-4 shrink-0" aria-hidden="true" /> {formatNumber(station.distance, 1)} km</div>
                        {station.openingHours && <div className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0" aria-hidden="true" /> {station.openingHours}</div>}
                        {station.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" aria-hidden="true" /> {station.phone}</div>}
                      </div>
                      {station.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-2">{station.amenities.map((a) => <Badge key={a} variant="outline" className="text-xs">{a}</Badge>)}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-start lg:items-end justify-center gap-1 lg:min-w-[160px]">
                      <div className="flex items-center gap-1">
                        <Euro className="h-5 w-5 text-green-700 dark:text-green-400" aria-hidden="true" />
                        <span className="text-2xl font-bold text-green-700 dark:text-green-400">{p !== undefined ? formatNumber(p, 3) : 'Sem preço'}</span>
                      </div>
                      {p !== undefined && <p className="text-sm text-muted-foreground">por litro</p>}
                      {p !== undefined && cheapest !== undefined && !isLowest && (
                        <p className="text-sm text-destructive">+{formatEuro((p - cheapest) * 50)} por 50 L</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
