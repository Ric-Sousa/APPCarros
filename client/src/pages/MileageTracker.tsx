import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { post, put, handleApiError } from '@/lib/apiUtils';
import Sidebar from '@/components/Sidebar';
import { useVehicles } from '@/hooks/useVehicles';
import { 
  Play, 
  Pause, 
  Square, 
  Timer, 
  Route, 
  Car, 
  MapPin,
  Save,
  RotateCcw,
  Clock
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';



interface TripRecord {
  id: string;
  vehicleId: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  startMileage: number;
  endMileage: number | null;
  totalDistance: number;
  status: 'active' | 'completed' | 'paused';
  notes?: string;
}

const MileageTracker: React.FC = () => {
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [startMileage, setStartMileage] = useState<string>('');
  const [currentMileage, setCurrentMileage] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [activeTrip, setActiveTrip] = useState<TripRecord | null>(null);
  
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedTimeRef = useRef<number>(0);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user vehicles
    const { data: vehicles = [] } = useVehicles();

  // Start trip mutation
  const startTrip = useMutation({
    mutationFn: async (data: {
      vehicleId: string;
      startMileage: number;
      notes?: string;
    }) => {
      return post<TripRecord>('/api/mileage-trips', {
        ...data,
        startTime: new Date().toISOString(),
        status: 'active'
      });
    },
    onSuccess: (trip) => {
      setActiveTrip(trip);
      toast({
        title: "Viagem Iniciada",
        description: "Gravação de quilómetros iniciada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: handleApiError(error, "Erro ao iniciar gravação."),
        variant: "destructive",
      });
    },
  });

  // End trip mutation
  const endTrip = useMutation({
    mutationFn: async (data: {
      tripId: string;
      endMileage: number;
      duration: number;
    }) => {
      return put<TripRecord>(`/api/mileage-trips/${data.tripId}`, {
        endTime: new Date().toISOString(),
        endMileage: data.endMileage,
        duration: data.duration,
        totalDistance: data.endMileage - (activeTrip?.startMileage || 0),
        status: 'completed'
      });
    },
    onSuccess: () => {
      toast({
        title: "Viagem Concluída",
        description: "Gravação salva com sucesso.",
      });
      resetTrip();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: handleApiError(error, "Erro ao finalizar gravação."),
        variant: "destructive",
      });
    },
  });

  // Timer effect
  useEffect(() => {
    if (isRecording && !isPaused) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTimeRef.current - pausedTimeRef.current) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRecording, isPaused]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = () => {
    if (!selectedVehicle || !startMileage) {
      toast({
        title: "Campos Obrigatórios",
        description: "Selecione um veículo e insira a quilometragem inicial.",
        variant: "destructive",
      });
      return;
    }

    const mileage = parseInt(startMileage);
    if (isNaN(mileage) || mileage < 0) {
      toast({
        title: "Quilometragem Inválida",
        description: "Insira uma quilometragem válida.",
        variant: "destructive",
      });
      return;
    }

    startTrip.mutate({
      vehicleId: selectedVehicle,
      startMileage: mileage,
      notes
    });

    setIsRecording(true);
    setIsPaused(false);
    startTimeRef.current = Date.now();
    pausedTimeRef.current = 0;
    setElapsedTime(0);
  };

  const handlePauseResume = () => {
    if (isPaused) {
      // Resume
      startTimeRef.current = Date.now() - (elapsedTime * 1000);
      setIsPaused(false);
    } else {
      // Pause
      pausedTimeRef.current += Date.now() - startTimeRef.current - (elapsedTime * 1000);
      setIsPaused(true);
    }
  };

  const handleStopRecording = () => {
    if (!currentMileage) {
      toast({
        title: "Quilometragem Final",
        description: "Insira a quilometragem final para concluir.",
        variant: "destructive",
      });
      return;
    }

    const endMileage = parseInt(currentMileage);
    const startMileageNum = parseInt(startMileage);

    if (isNaN(endMileage) || endMileage < startMileageNum) {
      toast({
        title: "Quilometragem Inválida",
        description: "A quilometragem final deve ser maior que a inicial.",
        variant: "destructive",
      });
      return;
    }

    if (activeTrip) {
      endTrip.mutate({
        tripId: activeTrip.id,
        endMileage,
        duration: elapsedTime
      });
    }
  };

  const resetTrip = () => {
    setIsRecording(false);
    setIsPaused(false);
    setElapsedTime(0);
    setActiveTrip(null);
    setStartMileage('');
    setCurrentMileage('');
    setNotes('');
    setSelectedVehicle('');
    pausedTimeRef.current = 0;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const selectedVehicleData = vehicles.find(v => v.id === selectedVehicle);
  const totalDistance = currentMileage && startMileage ? 
    parseInt(currentMileage) - parseInt(startMileage) : 0;

  return (
    <Sidebar>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 text-foreground">Gravador de Quilómetros</h1>
            <p className="text-muted-foreground">
            Inicie uma gravação para rastrear o tempo e distância da sua viagem
          </p>
        </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Configuração da Viagem
            </CardTitle>
            <CardDescription>
              Configure os detalhes antes de iniciar a gravação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle">Veículo</Label>
              <Select
                value={selectedVehicle}
                onValueChange={setSelectedVehicle}
                disabled={isRecording}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um veículo" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.brand} {vehicle.model} ({vehicle.licensePlate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startMileage">Quilometragem Inicial (km)</Label>
              <Input
                id="startMileage"
                type="number"
                placeholder="120000"
                value={startMileage}
                onChange={(e) => setStartMileage(e.target.value)}
                disabled={isRecording}
              />
            </div>

            {isRecording && (
              <div className="space-y-2">
                <Label htmlFor="currentMileage">Quilometragem Atual (km)</Label>
                <Input
                  id="currentMileage"
                  type="number"
                  placeholder="120025"
                  value={currentMileage}
                  onChange={(e) => setCurrentMileage(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notas (Opcional)</Label>
              <Input
                id="notes"
                placeholder="Viagem para..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isRecording}
              />
            </div>
          </CardContent>
        </Card>

        {/* Recording Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Controlo de Gravação
            </CardTitle>
            <CardDescription>
              {isRecording ? 'Gravação em curso' : 'Pronto para iniciar gravação'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Timer Display */}
            <div className="text-center">
                <div className="text-4xl font-mono font-bold mb-2 text-foreground">
                {formatTime(elapsedTime)}
              </div>
              <Badge variant={isRecording ? (isPaused ? "secondary" : "default") : "outline"}>
                {!isRecording ? 'Parado' : isPaused ? 'Pausado' : 'A Gravar'}
              </Badge>
            </div>

            {/* Vehicle Info */}
            {selectedVehicleData && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Car className="h-4 w-4" />
                  <span className="font-medium">
                    {selectedVehicleData.brand} {selectedVehicleData.model}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {selectedVehicleData.licensePlate} • {selectedVehicleData.year}
                </div>
              </div>
            )}

            {/* Distance Info */}
            {isRecording && (
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Início</div>
                  <div className="font-semibold">{parseInt(startMileage).toLocaleString()} km</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Distância</div>
                  <div className="font-semibold">{totalDistance} km</div>
                </div>
              </div>
            )}

            <Separator />

            {/* Control Buttons */}
            <div className="space-y-3">
              {!isRecording ? (
                <Button 
                  onClick={handleStartRecording}
                  className="w-full"
                  size="lg"
                  disabled={startTrip.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Iniciar Gravação
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button
                    onClick={handlePauseResume}
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    {isPaused ? (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Retomar
                      </>
                    ) : (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Pausar
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleStopRecording}
                    variant="default"
                    className="w-full"
                    size="lg"
                    disabled={endTrip.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Finalizar e Guardar
                  </Button>
                </div>
              )}

              {isRecording && (
                <Button
                  onClick={resetTrip}
                  variant="destructive"
                  className="w-full"
                  size="sm"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Cancelar Gravação
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Card */}
      {isRecording && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Resumo da Viagem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatTime(elapsedTime)}
                </div>
                <div className="text-sm text-gray-600">Tempo Decorrido</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {totalDistance} km
                </div>
                <div className="text-sm text-gray-600">Distância</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {totalDistance > 0 && elapsedTime > 0 
                    ? Math.round((totalDistance / (elapsedTime / 3600)) * 10) / 10 
                    : 0} km/h
                </div>
                <div className="text-sm text-gray-600">Velocidade Média</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {currentMileage || '---'}
                </div>
                <div className="text-sm text-gray-600">Km Atual</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </Sidebar>
  );
};

export default MileageTracker;
