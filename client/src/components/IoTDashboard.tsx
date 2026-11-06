import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import {
  Bluetooth,
  Wifi,
  Battery,
  Thermometer,
  Gauge,
  Zap,
  AlertTriangle,
  CheckCircle,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { post } from '@/lib/apiUtils';
import { queryClient } from '@/lib/queryClient';
import { useIoT } from '@/hooks/useIoT';

interface SensorData {
  id: string;
  type: 'obd2' | 'tire_pressure' | 'battery' | 'temperature' | 'fuel_level';
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  lastUpdate: string;
  connected: boolean;
  demo?: boolean;
}

interface IoTDevice {
  id: string;
  name: string;
  type: 'obd2_adapter' | 'tire_sensor' | 'battery_monitor';
  connected: boolean;
  batteryLevel?: number;
  signalStrength: number;
  lastSeen: string;
  demo?: boolean;
}

interface IoTDashboardProps {
  vehicleId: string;
}

const IoTDashboard: React.FC<IoTDashboardProps> = ({ vehicleId }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();
  const { sensorDataRealtime, devicesRealtime } = useIoT(vehicleId);

  const devicesKey = ['/api/vehicles', vehicleId, 'iot-devices'];
  const { data: fetchedDevices = [] } = useQuery<IoTDevice[]>({ queryKey: devicesKey });
  const { data: fetchedSensors = [] } = useQuery<SensorData[]>({
    queryKey: ['/api/vehicles', vehicleId, 'sensor-data'],
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Realtime device updates ({ vehicleId, device, data }) override fetched devices by id
  const devices = useMemo(() => {
    const map = new Map<string, IoTDevice>();
    fetchedDevices.forEach((d) => map.set(d.id, { ...d }));
    devicesRealtime.forEach((r) => {
      const existing = map.get(r.device);
      const payload = r.data || {};
      map.set(r.device, {
        id: r.device,
        name: payload.name || existing?.name || r.device,
        type: existing?.type || payload.type || 'obd2_adapter',
        connected: payload.connected ?? true,
        batteryLevel: payload.batteryLevel ?? existing?.batteryLevel,
        signalStrength: payload.signalStrength ?? existing?.signalStrength ?? 0,
        lastSeen: payload.lastSeen || new Date().toISOString(),
      });
    });
    return Array.from(map.values());
  }, [fetchedDevices, devicesRealtime]);

  // Realtime sensor readings first, then fetched ones not already present
  const sensorData = useMemo(() => {
    const map = new Map<string, SensorData>();
    sensorDataRealtime.forEach((r) => {
      const id = `${r.sensor}_${r.data?.ts || ''}`;
      map.set(id, {
        id,
        type: r.data?.type || 'obd2',
        name: r.sensor,
        value: r.data?.value ?? 0,
        unit: r.data?.unit || '',
        status: r.data?.status || 'good',
        lastUpdate: r.data?.ts || new Date().toISOString(),
        connected: true,
      });
    });
    fetchedSensors.forEach((s) => { if (!map.has(s.id)) map.set(s.id, s); });
    return Array.from(map.values());
  }, [fetchedSensors, sensorDataRealtime]);

  const isDemo = fetchedDevices.some((d) => d.demo) || fetchedSensors.some((s) => s.demo);

  const scanForDevices = async () => {
    setIsScanning(true);
    try {
      await post(`/api/vehicles/${vehicleId}/scan-devices`, {});
      toast({
        title: "Pesquisa Iniciada",
        description: "A procurar dispositivos IoT próximos...",
      });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: devicesKey });
        setIsScanning(false);
      }, 10000);
    } catch (error) {
      setIsScanning(false);
      toast({
        title: "Erro na Pesquisa",
        description: "Não foi possível pesquisar dispositivos.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return CheckCircle;
      case 'warning': return AlertTriangle;
      case 'critical': return AlertTriangle;
      default: return AlertTriangle;
    }
  };

  const getSensorIcon = (type: string) => {
    switch (type) {
      case 'tire_pressure': return Gauge;
      case 'battery': return Battery;
      case 'temperature': return Thermometer;
      case 'fuel_level': return Zap;
      default: return Gauge;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header with controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-blue-600" />
                            Dispositivos IoT e Sensores
              {isDemo && <Badge variant="outline">Dados de demonstração</Badge>}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                                onClick={() => setAutoRefresh(!autoRefresh)}
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                aria-pressed={autoRefresh}
                title="Atualização automática"
              >
                <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto
              </Button>
              <Button 
                onClick={scanForDevices}
                disabled={isScanning}
                size="sm"
              >
                <Bluetooth className="h-4 w-4 mr-1" />
                {isScanning ? 'A Pesquisar...' : 'Pesquisar'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Connected Devices */}
      <Card>
        <CardHeader>
          <CardTitle>Dispositivos Ligados</CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <WifiOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum dispositivo IoT ligado</p>
              <p className="text-sm">Use o botão "Pesquisar" para encontrar dispositivos</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.map((device) => (
                <div key={device.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{device.name}</h4>
                    <Badge variant={device.connected ? "default" : "secondary"}>
                      {device.connected ? 'Ligado' : 'Desligado'}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Sinal:</span>
                      <span>{device.signalStrength}%</span>
                    </div>
                    {device.batteryLevel && (
                      <div className="flex justify-between">
                        <span>Bateria:</span>
                        <span>{device.batteryLevel}%</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Última atividade:</span>
                      <span>{new Date(device.lastSeen).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Real-time Sensor Data */}
      <Card>
        <CardHeader>
          <CardTitle>Dados dos Sensores em Tempo Real</CardTitle>
        </CardHeader>
        <CardContent>
          {sensorData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Gauge className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum dado de sensor disponível</p>
              <p className="text-sm">Ligue dispositivos IoT para ver dados em tempo real</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {sensorData.map((sensor) => {
                const StatusIcon = getStatusIcon(sensor.status);
                const SensorIcon = getSensorIcon(sensor.type);
                
                return (
                  <div key={sensor.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <SensorIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">{sensor.name}</span>
                      </div>
                      <StatusIcon className={`h-4 w-4 ${getStatusColor(sensor.status)}`} />
                    </div>
                    
                    <div className="text-2xl font-bold mb-1">
                      {sensor.value} {sensor.unit}
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      Atualizado: {new Date(sensor.lastUpdate).toLocaleTimeString()}
                    </div>
                    
                    {sensor.status !== 'good' && (
                      <Alert className="mt-2">
                        <AlertTriangle className="h-3 w-3" />
                        <AlertDescription className="text-xs">
                          {sensor.status === 'warning' 
                            ? 'Valor fora do normal' 
                            : 'Atenção necessária'
                          }
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Como Configurar Dispositivos IoT</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">OBD-II Adapter</h4>
            <p className="text-sm text-gray-600">
              1. Ligue o adaptador OBD-II à porta do seu veículo<br />
              2. Ative o Bluetooth no seu telemóvel<br />
              3. Use o botão "Pesquisar" para encontrar o dispositivo
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Sensores de Pressão dos Pneus</h4>
            <p className="text-sm text-gray-600">
              1. Instale os sensores nas válvulas dos pneus<br />
              2. Calibre os pneus para inicializar os sensores<br />
              3. Os dados aparecerão automaticamente após a calibração
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Monitor de Bateria</h4>
            <p className="text-sm text-gray-600">
              1. Ligue o monitor aos terminais da bateria<br />
              2. Configure a capacidade da bateria na app<br />
              3. Monitorize a saúde da bateria em tempo real
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IoTDashboard;
