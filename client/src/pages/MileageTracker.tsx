import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Car, History, Pause, Play, RotateCcw, Route, Save, Timer, Trash2 } from 'lucide-react';
import type { MileageTrip } from '@shared/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Sidebar from '@/components/Sidebar';
import { useToast } from '@/hooks/use-toast';
import { useVehicles } from '@/hooks/useVehicles';
import { useUndoableDelete } from '@/hooks/useUndoableDelete';
import { del, post, put, handleApiError } from '@/lib/apiUtils';
import { formatDate, formatNumber } from '@/lib/utils';

const TRIPS_KEY = ['/api/mileage-trips'];

// Pausas ficam no navegador (o servidor só guarda início/fim); sobrevivem a recarregar a página
type PauseState = { pausedMs: number; pausedAt: number | null };
const pauseKey = (id: string) => `trip-pause-${id}`;
const readPause = (id: string): PauseState => {
  try {
    return JSON.parse(localStorage.getItem(pauseKey(id)) ?? '') as PauseState;
  } catch {
    return { pausedMs: 0, pausedAt: null };
  }
};

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
};

export default function MileageTracker() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: vehicles = [] } = useVehicles();
  const { data: trips = [] } = useQuery<MileageTrip[]>({ queryKey: TRIPS_KEY });

  const activeTrip = trips.find((t) => t.status === 'active') ?? null;
  const history = trips.filter((t) => t.status === 'completed').slice(0, 10);
  const removeTrip = useUndoableDelete<MileageTrip>({ queryKey: TRIPS_KEY, url: (id) => `/api/mileage-trips/${id}`, message: 'Viagem eliminada' });

  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [startMileage, setStartMileage] = useState('');
  const [currentMileage, setCurrentMileage] = useState('');
  const [notes, setNotes] = useState('');
  const [pause, setPause] = useState<PauseState>({ pausedMs: 0, pausedAt: null });
  const [now, setNow] = useState(Date.now());

  // Retoma uma viagem em curso guardada no servidor (ex.: depois de recarregar a página)
  useEffect(() => {
    if (!activeTrip) return;
    setSelectedVehicle(activeTrip.vehicleId);
    setStartMileage(String(activeTrip.startMileage));
    setNotes(activeTrip.notes ?? '');
    setPause(readPause(activeTrip.id));
  }, [activeTrip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeTrip || pause.pausedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeTrip, pause.pausedAt]);

  const savePause = (p: PauseState) => {
    setPause(p);
    if (activeTrip) {
      try { localStorage.setItem(pauseKey(activeTrip.id), JSON.stringify(p)); } catch {}
    }
  };

  const elapsed = activeTrip
    ? Math.max(0, Math.floor(((pause.pausedAt ?? now) - new Date(activeTrip.startTime).getTime() - pause.pausedMs) / 1000))
    : 0;

  const resetForm = () => {
    setSelectedVehicle('');
    setStartMileage('');
    setCurrentMileage('');
    setNotes('');
    setPause({ pausedMs: 0, pausedAt: null });
  };

  const refresh = () => [TRIPS_KEY, ['/api/vehicles'], ['/api/stats']].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));

  const startTrip = useMutation({
    mutationFn: (data: { vehicleId: string; startMileage: number; notes?: string }) =>
      post<MileageTrip>('/api/mileage-trips', { ...data, startTime: new Date().toISOString(), status: 'active' }),
    onSuccess: () => {
      setNow(Date.now());
      queryClient.invalidateQueries({ queryKey: TRIPS_KEY });
      toast({ title: 'Viagem iniciada', description: 'A gravação de quilómetros começou.' });
    },
    onError: (error) => toast({ title: 'Erro', description: handleApiError(error, 'Erro ao iniciar a gravação.'), variant: 'destructive' }),
  });

  const endTrip = useMutation({
    mutationFn: ({ trip, endMileage }: { trip: MileageTrip; endMileage: number }) =>
      put(`/api/mileage-trips/${trip.id}`, {
        endTime: new Date().toISOString(),
        endMileage,
        duration: elapsed,
        totalDistance: endMileage - trip.startMileage,
        status: 'completed',
      }),
    onSuccess: (_r, { trip }) => {
      try { localStorage.removeItem(pauseKey(trip.id)); } catch {}
      refresh();
      resetForm();
      toast({ title: 'Viagem concluída', description: 'Gravação guardada. Os quilómetros do veículo foram atualizados.' });
    },
    onError: (error) => toast({ title: 'Erro', description: handleApiError(error, 'Erro ao terminar a gravação.'), variant: 'destructive' }),
  });

  const cancelTrip = useMutation({
    mutationFn: (trip: MileageTrip) => del(`/api/mileage-trips/${trip.id}`),
    onSuccess: (_r, trip) => {
      try { localStorage.removeItem(pauseKey(trip.id)); } catch {}
      queryClient.invalidateQueries({ queryKey: TRIPS_KEY });
      resetForm();
      toast({ title: 'Gravação cancelada' });
    },
    onError: (error) => toast({ title: 'Erro', description: handleApiError(error), variant: 'destructive' }),
  });

  const handleStart = () => {
    const mileage = parseInt(startMileage, 10);
    if (!selectedVehicle || isNaN(mileage) || mileage < 0) {
      toast({ title: 'Campos obrigatórios', description: 'Selecione um veículo e indique uma quilometragem inicial válida.', variant: 'destructive' });
      return;
    }
    startTrip.mutate({ vehicleId: selectedVehicle, startMileage: mileage, notes: notes || undefined });
  };

  const handleStop = () => {
    if (!activeTrip) return;
    const endMileage = parseInt(currentMileage, 10);
    if (isNaN(endMileage) || endMileage < activeTrip.startMileage) {
      toast({ title: 'Quilometragem inválida', description: 'A quilometragem final deve ser maior ou igual à inicial.', variant: 'destructive' });
      return;
    }
    endTrip.mutate({ trip: activeTrip, endMileage });
  };

  const togglePause = () =>
    savePause(pause.pausedAt ? { pausedMs: pause.pausedMs + (Date.now() - pause.pausedAt), pausedAt: null } : { ...pause, pausedAt: Date.now() });

  const vehicleName = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.brand} ${v.model} (${v.licensePlate})` : 'Veículo';
  };
  const selected = vehicles.find((v) => v.id === selectedVehicle);
  const distance = activeTrip && currentMileage ? Math.max(0, parseInt(currentMileage, 10) - activeTrip.startMileage) : 0;
  const recording = !!activeTrip;

  return (
    <Sidebar>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Gravador de Quilómetros</h1>
          <p className="text-muted-foreground">Inicie uma gravação para registar o tempo e a distância da viagem</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Car className="h-5 w-5" aria-hidden="true" /> Configuração da Viagem</CardTitle>
              <CardDescription>Escolha o veículo antes de iniciar a gravação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="trip-vehicle">Veículo</Label>
                <Select
                  value={selectedVehicle || undefined}
                  onValueChange={(id) => {
                    setSelectedVehicle(id);
                    const v = vehicles.find((x) => x.id === id);
                    if (v) setStartMileage(String(v.currentMileage));
                  }}
                  disabled={recording}
                >
                  <SelectTrigger id="trip-vehicle"><SelectValue placeholder="Selecione um veículo" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} ({v.licensePlate})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startMileage">Quilometragem inicial (km)</Label>
                <Input id="startMileage" type="number" min="0" inputMode="numeric" placeholder="120000" value={startMileage} onChange={(e) => setStartMileage(e.target.value)} disabled={recording} />
              </div>
              {recording && (
                <div className="space-y-2">
                  <Label htmlFor="currentMileage">Quilometragem final (km)</Label>
                  <Input id="currentMileage" type="number" min="0" inputMode="numeric" placeholder="120025" value={currentMileage} onChange={(e) => setCurrentMileage(e.target.value)} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Input id="notes" placeholder="Viagem para..." value={notes} onChange={(e) => setNotes(e.target.value)} disabled={recording} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Timer className="h-5 w-5" aria-hidden="true" /> Controlo da Gravação</CardTitle>
              <CardDescription>{recording ? 'Gravação em curso' : 'Pronto para iniciar'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <div className="text-4xl font-mono font-bold mb-2" aria-live="off">{formatTime(elapsed)}</div>
                <Badge variant={recording ? (pause.pausedAt ? 'secondary' : 'default') : 'outline'}>
                  {!recording ? 'Parado' : pause.pausedAt ? 'Em pausa' : 'A gravar'}
                </Badge>
              </div>

              {selected && (
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1 font-medium"><Car className="h-4 w-4" aria-hidden="true" /> {selected.brand} {selected.model}</div>
                  <div className="text-sm text-muted-foreground">{selected.licensePlate} • {selected.year}</div>
                </div>
              )}

              {recording && activeTrip && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Início</div>
                    <div className="font-semibold">{formatNumber(activeTrip.startMileage)} km</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Distância</div>
                    <div className="font-semibold">{formatNumber(distance)} km</div>
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                {!recording ? (
                  <Button onClick={handleStart} className="w-full" size="lg" disabled={startTrip.isPending}>
                    <Play className="h-4 w-4 mr-2" aria-hidden="true" /> {startTrip.isPending ? 'A iniciar...' : 'Iniciar Gravação'}
                  </Button>
                ) : (
                  <>
                    <Button onClick={togglePause} variant="outline" className="w-full" size="lg">
                      {pause.pausedAt ? <Play className="h-4 w-4 mr-2" aria-hidden="true" /> : <Pause className="h-4 w-4 mr-2" aria-hidden="true" />}
                      {pause.pausedAt ? 'Retomar' : 'Pausar'}
                    </Button>
                    <Button onClick={handleStop} className="w-full" size="lg" disabled={endTrip.isPending}>
                      <Save className="h-4 w-4 mr-2" aria-hidden="true" /> {endTrip.isPending ? 'A guardar...' : 'Terminar e Guardar'}
                    </Button>
                    <Button onClick={() => activeTrip && cancelTrip.mutate(activeTrip)} variant="destructive" className="w-full" size="sm" disabled={cancelTrip.isPending}>
                      <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" /> Cancelar Gravação
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {recording && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Route className="h-5 w-5" aria-hidden="true" /> Resumo da Viagem</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                <div><div className="text-2xl font-bold">{formatTime(elapsed)}</div><div className="text-sm text-muted-foreground">Tempo decorrido</div></div>
                <div><div className="text-2xl font-bold">{formatNumber(distance)} km</div><div className="text-sm text-muted-foreground">Distância</div></div>
                <div>
                  <div className="text-2xl font-bold">{distance > 0 && elapsed > 0 ? formatNumber(distance / (elapsed / 3600), 1) : '—'} km/h</div>
                  <div className="text-sm text-muted-foreground">Velocidade média</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" aria-hidden="true" /> Viagens Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não há viagens concluídas.</p>
            ) : (
              <ul className="divide-y divide-border">
                {history.map((t) => (
                  <li key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="min-w-0">
                      <p className="font-medium break-words">{vehicleName(t.vehicleId)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(t.startTime)}{t.notes ? ` · ${t.notes}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm sm:text-right">
                      <span><span className="font-semibold">{formatNumber(t.totalDistance)} km</span>
                      <span className="text-muted-foreground"> · {formatTime(t.duration)}</span></span>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeTrip(t)} aria-label={`Eliminar viagem de ${formatDate(t.startTime)}`}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Sidebar>
  );
}
