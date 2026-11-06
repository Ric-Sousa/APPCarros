import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getAuthToken } from '@/lib/apiUtils';

interface SensorRealtime {
  vehicleId: string;
  sensor: string;
  data: any;
}

interface DeviceRealtime {
  vehicleId: string;
  device: string;
  data: any;
}

export function useIoT(vehicleId?: string) {
  const [sensorDataRealtime, setSensorDataRealtime] = useState<SensorRealtime[]>([]);
  const [devicesRealtime, setDevicesRealtime] = useState<DeviceRealtime[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // apenas conectar se tivermos vehicleId
    if (!vehicleId) return;

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const token = getAuthToken();
    const socket = io(SOCKET_URL, { path: '/socket.io', auth: token ? { token } : {} });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe_vehicle', vehicleId);
    });

    socket.on('iot:sensor', (payload: any) => {
      if (payload.vehicleId !== vehicleId) return;
      setSensorDataRealtime((s) => [payload, ...s].slice(0, 200));
    });

    socket.on('iot:device', (payload: any) => {
      if (payload.vehicleId !== vehicleId) return;
      setDevicesRealtime((d) => [payload, ...d].slice(0, 200));
    });

    return () => {
      try {
        socket.emit('unsubscribe_vehicle', vehicleId);
        socket.disconnect();
      } catch (e) {}
      socketRef.current = null;
    };
  }, [vehicleId]);

  return { sensorDataRealtime, devicesRealtime, socket: socketRef.current };
}
