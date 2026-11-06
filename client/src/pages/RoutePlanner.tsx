import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useVehicles } from '@/hooks/useVehicles';
import { queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Sidebar from "@/components/Sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { get, post, put, del, handleApiError } from '@/lib/apiUtils';



export default function RoutePlanner() {
  const { toast } = useToast();
  
  const [vehicleId, setVehicleId] = useState('');
  const [energyType, setEnergyType] = useState<'gasoline' | 'diesel' | 'electric'>('gasoline');
  const [originText, setOriginText] = useState('');
  const [destinationText, setDestinationText] = useState('');
  const [originLat, setOriginLat] = useState('');
  const [originLon, setOriginLon] = useState('');
  const [destinationLat, setDestinationLat] = useState('');
  const [destinationLon, setDestinationLon] = useState('');
  const [consumption, setConsumption] = useState('7.0');
  const [capacity, setCapacity] = useState('50');
  const [currentLevelPercent, setCurrentLevelPercent] = useState('80');
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [planName, setPlanName] = useState('');
    const { data: vehicles = [] } = useVehicles();
  const { data: savedPlans = [], isLoading: loadingPlans } = useQuery<{ plans: any[] }, Error, any[]>({
    queryKey: ['/api/route-plans'],
    select: (data) => data.plans || [],
  });
  const refreshPlans = () => queryClient.invalidateQueries({ queryKey: ['/api/route-plans'] });

  useEffect(() => {
    if (vehicles.length > 0 && !vehicleId) {
      setVehicleId(vehicles[0].id);
    }
  }, [vehicles, vehicleId]);


  const handlePlan = async () => {
    try {
            setLoading(true);
      const body = {
        originLat: parseFloat(originLat),
        originLon: parseFloat(originLon),
        destinationLat: parseFloat(destinationLat),
        destinationLon: parseFloat(destinationLon),
        vehicleId,
        energyType,
        consumption: parseFloat(consumption),
        capacity: parseFloat(capacity),
        currentLevelPercent: parseFloat(currentLevelPercent),
      };
            const data = await post<any>("/api/route-planner", body);
      setResult({ ...data, origin: [body.originLat, body.originLon], dest: [body.destinationLat, body.destinationLon] });
      toast({ title: 'Rota planeada', description: 'Planeamento concluído com sucesso.' });
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha ao planear rota' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Desenhar mapa quando existir resultado
    if (!result) return;
    const L = (window as any).L;
    if (!L) return;

        const origin: number[] = result.origin || [];
    const dest: number[] = result.dest || [];
    if (origin.length !== 2 || dest.length !== 2 || origin.some(isNaN) || dest.some(isNaN)) return;

    // Um mapa por resultado; removido na limpeza (evita "Map container is already initialized")
    const map = L.map('route-map');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);

    // Marcadores origem/destino
    const originMarker = L.marker(origin);
    const destMarker = L.marker(dest);
    layer.addLayer(originMarker);
    layer.addLayer(destMarker);

    const bounds = L.latLngBounds([origin, dest]);

    // Polyline da rota (se disponível)
    if (result.geometry && result.geometry.coordinates && Array.isArray(result.geometry.coordinates)) {
      const coords = result.geometry.coordinates.map((c: any) => [c[1], c[0]]);
      const routeLine = L.polyline(coords, { color: 'blue', weight: 4 });
      layer.addLayer(routeLine);
      bounds.extend(routeLine.getBounds());
    }

    // Paragens sugeridas
    if (Array.isArray(result.stops)) {
      result.stops.forEach((group: any) => {
        (group.suggested || []).forEach((s: any) => {
          if (typeof s.lat === 'number' && typeof s.lon === 'number') {
            const marker = L.circleMarker([s.lat, s.lon], {
              radius: 5,
              color: group.type === 'charging' ? 'green' : 'orange'
            }).bindTooltip(`${s.name || ''}${s.distance ? ` • ${s.distance} km` : ''}`);
            layer.addLayer(marker);
            bounds.extend([s.lat, s.lon]);
          }
        });
      });
    }

        // Ajustar vista
    map.fitBounds(bounds.pad(0.15));
    return () => map.remove();
  }, [result]);

  const geocode = async (type: 'origin' | 'destination') => {
    try {
      const q = type === 'origin' ? originText : destinationText;
      if (!q) return;
      const data = await get<{ results: Array<{ lat: number; lng: number; label?: string }> }>(`/api/geocode?q=${encodeURIComponent(q)}`);
      const first = data.results?.[0];
      if (!first) throw new Error('Morada não encontrada');
      if (type === 'origin') {
        setOriginLat(String(first.lat));
        setOriginLon(String(first.lng));
      } else {
        setDestinationLat(String(first.lat));
        setDestinationLon(String(first.lng));
      }
      toast({ title: 'Geocoding concluído', description: first.label || 'Coordenadas preenchidas' });
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha no geocoding' });
    }
  };

  const saveCurrentPlan = async () => {
    try {
      if (!result) {
        toast({ title: 'Nada para guardar', description: 'Calcule a rota primeiro.' });
        return;
      }
      
      const payload: any = {
        name: planName || `${originText || originLat} → ${destinationText || destinationLat}`,
        originLat: parseFloat(originLat),
        originLon: parseFloat(originLon),
        destinationLat: parseFloat(destinationLat),
        destinationLon: parseFloat(destinationLon),
        vehicleId,
        energyType,
        consumption: parseFloat(consumption),
        capacity: parseFloat(capacity),
        currentLevelPercent: parseFloat(currentLevelPercent),
        totalDistanceKm: result.totalDistanceKm,
        durationMin: result.durationMin,
        geometry: result.geometry,
      };
      const resp = await post<{ success: boolean; id: string }>("/api/route-plans", payload);
      if (resp && (resp as any).success) {
                toast({ title: 'Plano guardado', description: 'O plano foi guardado com sucesso.' });
        refreshPlans();
        setPlanName('');
      }
    } catch (error) {
      const msg = handleApiError(error, 'Falha ao guardar o plano');
      toast({ title: 'Erro', description: msg });
    }
  };

  const applyPlan = (plan: any) => {
    setOriginLat(String(plan.originLat ?? ''));
    setOriginLon(String(plan.originLon ?? ''));
    setDestinationLat(String(plan.destinationLat ?? ''));
    setDestinationLon(String(plan.destinationLon ?? ''));
    setVehicleId(plan.vehicleId ?? vehicleId);
    setEnergyType(plan.energyType ?? energyType);
    setConsumption(String(plan.consumption ?? consumption));
    setCapacity(String(plan.capacity ?? capacity));
    setCurrentLevelPercent(String(plan.currentLevelPercent ?? currentLevelPercent));

    // Desenhar rota guardada sem recálculo, se houver geometria e distância
    try {
      const distanceKm = typeof plan.totalDistanceKm === 'number' ? plan.totalDistanceKm : NaN;
      const cons = parseFloat(String(plan.consumption ?? consumption));
      const cap = parseFloat(String(plan.capacity ?? capacity));
      const lvl = parseFloat(String(plan.currentLevelPercent ?? currentLevelPercent));
      const priceMap: Record<string, number> = {
        gasoline: 1.75,
        diesel: 1.65,
        electric: 0.20,
      };
      const pricePerUnit = priceMap[(plan.energyType ?? energyType) as 'gasoline' | 'diesel' | 'electric'] ?? 1.7;
      const estimatedUnits = isFinite(distanceKm) ? Number(((distanceKm / 100) * cons).toFixed(2)) : undefined;
      const estimatedCost = estimatedUnits !== undefined ? Number((estimatedUnits * pricePerUnit).toFixed(2)) : undefined;
      const availableRangeKm = isFinite(cons) && isFinite(cap) && isFinite(lvl)
        ? Number((((cap * (lvl / 100)) / cons) * 100).toFixed(1))
        : undefined;

      setResult({
        totalDistanceKm: distanceKm,
        durationMin: typeof plan.durationMin === 'number' ? plan.durationMin : undefined,
        estimatedUnits,
        estimatedCost,
        availableRangeKm,
                geometry: plan.geometry,
        stops: [],
        origin: [Number(plan.originLat), Number(plan.originLon)],
        dest: [Number(plan.destinationLat), Number(plan.destinationLon)],
      });
    } catch { }

    toast({ title: 'Plano aplicado', description: 'Campos atualizados e rota guardada apresentada.' });
  };

  const renamePlan = async (plan: any) => {
    const newName = window.prompt('Novo nome para o plano:', plan.name || '') || '';
    if (!newName.trim()) return;
    try {
            await put(`/api/route-plans/${plan.id}`, { name: newName.trim() });
      refreshPlans();
      toast({ title: 'Plano atualizado', description: 'Nome alterado com sucesso.' });
    } catch (error) {
      const msg = handleApiError(error, 'Falha ao atualizar plano');
      toast({ title: 'Erro', description: msg });
    }
  };

  const deletePlan = async (id: string) => {
    try {
            await del(`/api/route-plans/${id}`);
      refreshPlans();
      toast({ title: 'Plano removido', description: 'Plano apagado com sucesso.' });
    } catch (error) {
      const msg = handleApiError(error, 'Falha ao apagar plano');
      toast({ title: 'Erro', description: msg });
    }
  };

  return (
    <Sidebar>
      <div className="max-w-5xl mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Planeador de Rotas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Origem (morada)</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={originText} onChange={(e) => setOriginText(e.target.value)} placeholder="Av. da Boavista, Porto" />
                  <Button variant="secondary" onClick={() => geocode('origin')}>Procurar</Button>
                </div>
              </div>
              <div>
                <Label>Destino (morada)</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={destinationText} onChange={(e) => setDestinationText(e.target.value)} placeholder="Praça do Comércio, Lisboa" />
                  <Button variant="secondary" onClick={() => geocode('destination')}>Procurar</Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Veículo</Label>
                <Select value={vehicleId} onValueChange={setVehicleId}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Selecione o veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} ({v.licensePlate})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Energia</Label>
                <Select value={energyType} onValueChange={(v) => setEnergyType(v as any)}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gasoline">Gasolina</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="electric">Elétrico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Consumo ({energyType === 'electric' ? 'kWh/100km' : 'L/100km'})</Label>
                <Input type="number" step="0.1" value={consumption} onChange={(e) => setConsumption(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Origem Lat</Label>
                <Input value={originLat} onChange={(e) => setOriginLat(e.target.value)} placeholder="38.7223" />
              </div>
              <div>
                <Label>Origem Lon</Label>
                <Input value={originLon} onChange={(e) => setOriginLon(e.target.value)} placeholder="-9.1393" />
              </div>
              <div>
                <Label>Destino Lat</Label>
                <Input value={destinationLat} onChange={(e) => setDestinationLat(e.target.value)} placeholder="41.1579" />
              </div>
              <div>
                <Label>Destino Lon</Label>
                <Input value={destinationLon} onChange={(e) => setDestinationLon(e.target.value)} placeholder="-8.6291" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>{energyType === 'electric' ? 'Bateria (kWh)' : 'Depósito (L)'}</Label>
                <Input type="number" step="0.1" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </div>
              <div>
                <Label>Nível Atual (%)</Label>
                <Input type="number" step="1" value={currentLevelPercent} onChange={(e) => setCurrentLevelPercent(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={handlePlan} disabled={loading}>
                  {loading ? 'A planear...' : 'Planear Rota'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Resultado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div id="route-map" className="w-full h-72 rounded border" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Distância Total</Label>
                  <p className="font-medium">{result.totalDistanceKm} km</p>
                </div>
                <div>
                  <Label>Consumo Estimado</Label>
                  <p className="font-medium">{result.estimatedUnits} {energyType === 'electric' ? 'kWh' : 'L'}</p>
                </div>
                <div>
                  <Label>Custo Estimado</Label>
                  <p className="font-medium">€{result.estimatedCost}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Duração Estimada</Label>
                  <p className="font-medium">{result.durationMin ? `${result.durationMin} min` : '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <Label>Nome do Plano</Label>
                  <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Ex.: Porto → Lisboa (A1)" />
                </div>
                <div className="flex items-end">
                  <Button className="w-full" onClick={saveCurrentPlan}>Guardar Plano</Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Autonomia Disponível</Label>
                  <p className="font-medium">{result.availableRangeKm ?? '—'} km</p>
                </div>
                <div>
                  <Label>Requer Paragem?</Label>
                  <p className="font-medium">{result.needsStop ? 'Sim' : 'Não'}</p>
                </div>
              </div>
              {result.stops && result.stops.length > 0 && (
                <div className="space-y-2">
                  <Label>Paragens Sugeridas</Label>
                  <div className="grid gap-3">
                    {result.stops.map((group: any, idx: number) => (
                      <div key={idx} className="border rounded p-3">
                        <p className="text-sm text-muted-foreground">{group.type === 'charging' ? 'Carregamento' : 'Abastecimento'}</p>
                        <div className="grid md:grid-cols-2 gap-2 mt-2">
                          {group.suggested.map((s: any) => (
                            <div key={s.id} className="text-sm">
                              <p className="font-medium">{s.name}</p>
                              <p className="text-gray-600">{s.address || '—'}</p>
                              <p className="text-gray-600">{s.distance} km</p>
                              {typeof s.estimatedChargingTimeMin === 'number' && (
                                <p className="text-gray-600">Tempo de carga: {s.estimatedChargingTimeMin} min</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Planos Guardados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingPlans ? (
              <p>A carregar…</p>
            ) : savedPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem planos guardados.</p>
            ) : (
              <div className="grid gap-3">
                {savedPlans.map((p: any) => (
                  <div key={p.id} className="border rounded p-3 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{p.name || 'Plano'}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.totalDistanceKm ? `${p.totalDistanceKm} km` : '—'}
                        {p.durationMin ? ` • ${p.durationMin} min` : ''}
                      </p>
                      <p className="text-xs text-gray-500">{p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => applyPlan(p)}>Aplicar</Button>
                      <Button variant="outline" onClick={() => renamePlan(p)}>Renomear</Button>
                      <Button variant="destructive" onClick={() => deletePlan(p.id)}>Eliminar</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Sidebar>
  );
}