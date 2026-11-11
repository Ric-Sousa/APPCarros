// Ponte IoT: mensagens MQTT dos dispositivos -> Socket.IO para os browsers dos donos dos veículos.
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mqtt, { MqttClient } from 'mqtt';
import { verifyJwt } from './jwtUtils';
import { storage } from './storage';

export interface IoTGatewayOptions {
  httpServer: HttpServer;
  /** Mesma regra de origens do Express (CORS_ORIGINS + a própria app). */
  isAllowedOrigin: (origin: string | undefined, host: string | undefined) => boolean;
}

export function initIoTGateway({ httpServer, isAllowedOrigin }: IoTGatewayOptions) {
  const io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    cors: { origin: true, methods: ['GET', 'POST'] },
    allowRequest: (req, callback) => callback(null, isAllowedOrigin(req.headers.origin, req.headers.host)),
  });

  // Autenticação com o JWT enviado no handshake (auth.token ou header Authorization)
  io.use((socket, next) => {
    const raw = String(socket.handshake.auth?.token || socket.handshake.headers.authorization || '');
    const payload = verifyJwt(raw.startsWith('Bearer ') ? raw.slice(7) : raw);
    if (!payload) return next(new Error('unauthorized'));
    socket.data.user = payload;
    next();
  });

  io.on('connection', (socket) => {
    // A ligação termina quando o token expira (o cliente volta a ligar com um token novo)
    const exp = (socket.data.user as { exp?: number }).exp;
    if (exp) {
      const timer = setTimeout(() => socket.disconnect(true), Math.max(0, exp * 1000 - Date.now()));
      socket.on('disconnect', () => clearTimeout(timer));
    }

    // Só entra na sala do veículo se o veículo pertencer ao utilizador autenticado
    socket.on('subscribe_vehicle', async (vehicleId: unknown) => {
      const vehicle = typeof vehicleId === 'string'
        ? await storage.getUserVehicle(socket.data.user.sub, vehicleId).catch(() => undefined)
        : undefined;
      if (!vehicle) {
        socket.emit('iot:error', { vehicleId, message: 'Veículo não encontrado' });
        return;
      }
      socket.join(`vehicle_${vehicle.id}`);
    });

    socket.on('unsubscribe_vehicle', (vehicleId: unknown) => {
      if (typeof vehicleId === 'string') socket.leave(`vehicle_${vehicleId}`);
    });
  });

  const mqttUrl = process.env.FEATURE_IOT === 'true' ? process.env.MQTT_URL : undefined;
  if (!mqttUrl) {
    console.log('🔕 MQTT desligado (requer FEATURE_IOT=true e MQTT_URL).');
    return { io, mqttClient: null as MqttClient | null };
  }

  const client = mqtt.connect(mqttUrl, {
    username: process.env.MQTT_USER || undefined,
    password: process.env.MQTT_PASS || undefined,
  });

  client.on('connect', () => {
    console.log('🔗 Ligado ao broker MQTT', mqttUrl);
    // vehicle/{vehicleId}/sensor/{nome} e vehicle/{vehicleId}/device/{nome}
    client.subscribe(['vehicle/+/sensor/+', 'vehicle/+/device/+'], { qos: 0 }, (err) => {
      if (err) console.error('Erro ao subscrever os tópicos MQTT:', err.message);
    });
  });

  client.on('message', (topic, payload) => {
    const [root, vehicleId, kind, ...rest] = topic.split('/');
    if (root !== 'vehicle' || !vehicleId || rest.length === 0) return;
    let data: unknown;
    try {
      data = JSON.parse(payload.toString());
    } catch {
      return; // mensagem que não é JSON: ignorada
    }
    const name = rest.join('/');
    if (kind === 'sensor') io.to(`vehicle_${vehicleId}`).emit('iot:sensor', { vehicleId, sensor: name, data });
    if (kind === 'device') io.to(`vehicle_${vehicleId}`).emit('iot:device', { vehicleId, device: name, data });
  });

  client.on('error', (err) => console.error('Erro MQTT:', err.message));

  return { io, mqttClient: client as MqttClient | null };
}
