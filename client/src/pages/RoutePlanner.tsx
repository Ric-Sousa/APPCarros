import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Sidebar from '@/components/Sidebar';
import RouteMap from '@/components/RouteMap';
import SavedRoutePlans, { type RoutePlan } from '@/components/SavedRoutePlans';
import { useVehicles } from '@/hooks/useVehicles';
import { useToast } from '@/hooks/use-toast';
import { get, post, handleApiError } from '@/lib/apiUtils';
import { formatEuro, formatNumber } from '@/lib/utils';
import { isElectric, normalizeFuelType } from '@shared/fuel';

type Energy = 'gasoline' | 'diesel' | 'electric';
const PRICE: Record<Energy, number> = { gasoline: 1.75, diesel: 1.65, electric: 0.2 };

interface PlanResult {
  totalDistanceKm: number;
  durationMin?: number;
  estimatedUnits?: number;
  estimatedCost?: number;
  availableRangeKm?: number | null;
  needsStop?: boolean;
  geometry?: { coordinates?: [number, number][] } | null;
  stops?: { type: string; suggested: { id: string; name?: string; address?: string; distance?: number; lat?: number; lon?: number; estimatedChargingTimeMin?: number }[] }[];
  origin: [number, number];
  dest: [number, number];
}

const energyOf = (fuel: unknown): Energy => (isElectric(fuel) ? 'electric' : normalizeFuelType(fuel) === 'diesel' ? 'diesel' : 'gasoline');

export default function RoutePlanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: vehicles = [] } = useVehicles();

  const [vehicleId, setVehicleId] = useState('');
  const [energyType, setEnergyType] = useState<Energy>('gasoline');
  const [originText, setOriginText] = useState('');
  const [destinationText, setDestinationText] = useState('');
  const [coords, setCoords] = useState({ originLat: '', originLon: '', destinationLat: '', destinationLon: '' });
  const [consumption, setConsumption] = useState('7.0');
  const [capacity, setCapacity] = useState('50');
  const [currentLevelPercent, setCurrentLevelPercent] = useState('80');
  const [result, setResult] = useState<PlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [planName, setPlanName] = useState('');

  // Primeiro veículo por omissão, com o tipo de energia dele
  useEffect(() => {
    if (vehicles.length > 0 && !vehicleId) {
      setVehicleId(vehicles[0].id);
      setEnergyType(energyOf(vehicles[0].fuelType));
    }
  }, [vehicles, vehicleId]);

  const num = (v: string) => parseFloat(v.replace(',', '.'));
  const origin: [number, number] = [num(coords.originLat), num(coords.originLon)];
  const dest: [number, number] = [num(coords.destinationLat), num(coords.destinationLon)];
  const setCoord = (key: keyof typeof coords) => (e: React.ChangeEvent<HTMLInputElement>) => setCoords((c) => ({ ...c, [key]: e.target.value }));

  const handlePlan = async () => {
    if ([...origin, ...dest].some((n) => !Number.isFinite(n))) {
      toast({ title: 'Faltam coordenadas', description: 'Procure as moradas de origem e destino ou indique as coordenadas.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const data = await post<Omit<PlanResult, 'origin' | 'dest'>>('/api/route-planner', {
        originLat: origin[0], originLon: origin[1], destinationLat: dest[0], destinationLon: dest[1],
        vehicleId, energyType, consumption: num(consumption), capacity: num(capacity), currentLevelPercent: num(currentLevelPercent),
      });
      setResult({ ...data, origin, dest });
    } catch (e) {
      toast({ title: 'Erro', description: handleApiError(e, 'Falha ao planear a rota'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const geocode = async (type: 'origin' | 'destination') => {
    const q = type === 'origin' ? originText : destinationText;
    if (!q.trim()) return;
    try {
      const data = await get<{ results: { lat: number; lng: number; label?: string }[] }>(`/api/geocode?q=${encodeURIComponent(q)}`);
      const first = data.results?.[0];
      if (!first) throw new Error('Morada não encontrada');
      setCoords((c) => (type === 'origin' ? { ...c, originLat: String(first.lat), originLon: String(first.lng) } : { ...c, destinationLat: String(first.lat), destinationLon: String(first.lng) }));
      toast({ title: 'Morada encontrada', description: first.label || 'Coordenadas preenchidas' });
    } catch (e) {
      toast({ title: 'Erro', description: handleApiError(e, 'Falha ao procurar a morada'), variant: 'destructive' });
    }
  };

  const saveCurrentPlan = async () => {
    if (!result) return;
    try {
      await post('/api/route-plans', {
        name: planName || `${originText || coords.originLat} → ${destinationText || coords.destinationLat}`,
        originLat: origin[0], originLon: origin[1], destinationLat: dest[0], destinationLon: dest[1],
        vehicleId, energyType, consumption: num(consumption), capacity: num(capacity), currentLevelPercent: num(currentLevelPercent),
        totalDistanceKm: result.totalDistanceKm, durationMin: result.durationMin, geometry: result.geometry,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/route-plans'] });
      setPlanName('');
      toast({ title: 'Plano guardado' });
    } catch (error) {
      toast({ title: 'Erro', description: handleApiError(error, 'Falha ao guardar o plano'), variant: 'destructive' });
    }
  };

  // Mostra um plano guardado sem recalcular (custo e autonomia calculados localmente)
  const applyPlan = (plan: RoutePlan) => {
    const energy = plan.energyType ?? energyType;
    const cons = plan.consumption ?? num(consumption);
    const cap = plan.capacity ?? num(capacity);
    const lvl = plan.currentLevelPercent ?? num(currentLevelPercent);
    setCoords({ originLat: String(plan.originLat), originLon: String(plan.originLon), destinationLat: String(plan.destinationLat), destinationLon: String(plan.destinationLon) });
    setVehicleId(plan.vehicleId);
    setEnergyType(energy);
    setConsumption(String(cons));
    setCapacity(String(cap));
    setCurrentLevelPercent(String(lvl));
    const distance = plan.totalDistanceKm ?? 0;
    const units = Number(((distance / 100) * cons).toFixed(2));
    setResult({
      totalDistanceKm: distance,
      durationMin: plan.durationMin,
      estimatedUnits: units,
      estimatedCost: Number((units * PRICE[energy]).toFixed(2)),
      availableRangeKm: cons > 0 ? Number((((cap * (lvl / 100)) / cons) * 100).toFixed(1)) : null,
      geometry: plan.geometry as PlanResult['geometry'],
      stops: [],
      origin: [plan.originLat, plan.originLon],
      dest: [plan.destinationLat, plan.destinationLon],
    });
  };

  const unit = energyType === 'electric' ? 'kWh' : 'L';

  return (
    <Sidebar>
      <div className="max-w-5xl mx-auto p-4 space-y-6">
        <Card>
          <CardHeader><CardTitle>Planeador de Rotas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="route-origin">Origem (morada)</Label>
                <div className="flex gap-2 mt-1">
                  <Input id="route-origin" value={originText} onChange={(e) => setOriginText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && geocode('origin')} placeholder="Av. da Boavista, Porto" />
                  <Button variant="secondary" onClick={() => geocode('origin')}>Procurar</Button>
                </div>
              </div>
              <div>
                <Label htmlFor="route-destination">Destino (morada)</Label>
                <div className="flex gap-2 mt-1">
                  <Input id="route-destination" value={destinationText} onChange={(e) => setDestinationText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && geocode('destination')} placeholder="Praça do Comércio, Lisboa" />
                  <Button variant="secondary" onClick={() => geocode('destination')}>Procurar</Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="route-vehicle">Veículo</Label>
                <Select value={vehicleId} onValueChange={(id) => { setVehicleId(id); setEnergyType(energyOf(vehicles.find((v) => v.id === id)?.fuelType)); }}>
                  <SelectTrigger id="route-vehicle" className="w-full mt-1"><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} ({v.licensePlate})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="route-energy">Energia</Label>
                <Select value={energyType} onValueChange={(v) => setEnergyType(v as Energy)}>
                  <SelectTrigger id="route-energy" className="w-full mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gasoline">Gasolina</SelectItem>
                    <SelectItem value="diesel">Gasóleo</SelectItem>
                    <SelectItem value="electric">Elétrico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="route-consumption">Consumo ({unit}/100km)</Label>
                <Input id="route-consumption" type="number" step="0.1" min="0" value={consumption} onChange={(e) => setConsumption(e.target.value)} className="mt-1" />
              </div>
            </div>

            <details className="rounded-md border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">Coordenadas (preenchidas ao procurar a morada)</summary>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                <div><Label htmlFor="o-lat">Origem lat.</Label><Input id="o-lat" inputMode="decimal" value={coords.originLat} onChange={setCoord('originLat')} placeholder="38,7223" /></div>
                <div><Label htmlFor="o-lon">Origem long.</Label><Input id="o-lon" inputMode="decimal" value={coords.originLon} onChange={setCoord('originLon')} placeholder="-9,1393" /></div>
                <div><Label htmlFor="d-lat">Destino lat.</Label><Input id="d-lat" inputMode="decimal" value={coords.destinationLat} onChange={setCoord('destinationLat')} placeholder="41,1579" /></div>
                <div><Label htmlFor="d-lon">Destino long.</Label><Input id="d-lon" inputMode="decimal" value={coords.destinationLon} onChange={setCoord('destinationLon')} placeholder="-8,6291" /></div>
              </div>
            </details>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="route-capacity">{energyType === 'electric' ? 'Bateria (kWh)' : 'Depósito (L)'}</Label>
                <Input id="route-capacity" type="number" step="0.1" min="0" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="route-level">Nível atual (%)</Label>
                <Input id="route-level" type="number" step="1" min="0" max="100" value={currentLevelPercent} onChange={(e) => setCurrentLevelPercent(e.target.value)} className="mt-1" />
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={handlePlan} disabled={loading || !vehicleId}>{loading ? 'A planear...' : 'Planear Rota'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader><CardTitle>Resultado</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <RouteMap origin={result.origin} dest={result.dest} geometry={result.geometry} stops={result.stops} />
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><dt className="text-sm text-muted-foreground">Distância total</dt><dd className="font-medium">{formatNumber(result.totalDistanceKm, 1)} km</dd></div>
                <div><dt className="text-sm text-muted-foreground">Duração estimada</dt><dd className="font-medium">{result.durationMin ? `${result.durationMin} min` : '—'}</dd></div>
                <div><dt className="text-sm text-muted-foreground">Consumo estimado</dt><dd className="font-medium">{result.estimatedUnits != null ? `${formatNumber(result.estimatedUnits, 1)} ${unit}` : '—'}</dd></div>
                <div><dt className="text-sm text-muted-foreground">Custo estimado</dt><dd className="font-medium">{result.estimatedCost != null ? formatEuro(result.estimatedCost) : '—'}</dd></div>
                <div><dt className="text-sm text-muted-foreground">Autonomia disponível</dt><dd className="font-medium">{result.availableRangeKm != null ? `${formatNumber(result.availableRangeKm)} km` : '—'}</dd></div>
                <div><dt className="text-sm text-muted-foreground">Precisa de parar?</dt><dd className="font-medium">{result.needsStop ? 'Sim' : 'Não'}</dd></div>
              </dl>

              {!!result.stops?.length && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Paragens sugeridas</h3>
                  {result.stops.map((group, idx) => (
                    <div key={idx} className="border border-border rounded p-3">
                      <p className="text-sm text-muted-foreground">{group.type === 'charging' ? 'Carregamento' : 'Abastecimento'}</p>
                      <div className="grid md:grid-cols-2 gap-2 mt-2">
                        {group.suggested.map((s) => (
                          <div key={s.id} className="text-sm">
                            <p className="font-medium">{s.name}</p>
                            <p className="text-muted-foreground">{s.address || '—'}</p>
                            {s.distance != null && <p className="text-muted-foreground">{formatNumber(s.distance, 1)} km</p>}
                            {typeof s.estimatedChargingTimeMin === 'number' && <p className="text-muted-foreground">Tempo de carga: {s.estimatedChargingTimeMin} min</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="plan-name">Nome do plano</Label>
                  <Input id="plan-name" value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Ex.: Porto → Lisboa (A1)" className="mt-1" />
                </div>
                <div className="flex items-end">
                  <Button className="w-full" onClick={saveCurrentPlan}>Guardar Plano</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <SavedRoutePlans onApply={applyPlan} />
      </div>
    </Sidebar>
  );
}
