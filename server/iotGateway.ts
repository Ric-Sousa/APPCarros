import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mqtt, { MqttClient } from 'mqtt';
import { verifyJwt } from './jwtUtils';
import { storage } from './storage';

export interface IoTGatewayOptions {
  httpServer: HttpServer;
  allowedOrigins: string[];
  mqttUrl?: string;
  mqttUser?: string;
  mqttPass?: string;
}

export function initIoTGateway(opts: IoTGatewayOptions) {
  const { httpServer, allowedOrigins, mqttUrl = process.env.MQTT_URL, mqttUser = process.env.MQTT_USER, mqttPass = process.env.MQTT_PASS } = opts;

  // Socket.IO server
  const io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST']
    }
  });

  // Authenticate sockets using JWT passed in handshake auth
  io.use((socket, next) => {
    try {
      const tokenRaw = socket.handshake.auth?.token || socket.handshake.headers['authorization'];
      if (!tokenRaw) return next(new Error('unauthorized'));

      // token may be in form 'Bearer <token>'
      const token = String(tokenRaw).startsWith('Bearer ') ? String(tokenRaw).split(' ')[1] : String(tokenRaw);
      const payload = verifyJwt(token as string);
      if (!payload) return next(new Error('unauthorized'));

      // attach user payload to socket.data for later use
      socket.data.user = payload;
      return next();
    } catch (err) {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    console.log('🔌 Socket.IO client connected:', socket.id, 'user=', socket.data.user?.sub || 'unknown');

    // Só entra na sala do veículo se o veículo pertencer ao utilizador autenticado
    socket.on('subscribe_vehicle', async (vehicleId: string) => {
      const vehicle = typeof vehicleId === 'string' && await storage.getUserVehicle(socket.data.user.sub, vehicleId).catch(() => undefined);
      if (!vehicle) {
        socket.emit('iot:error', { vehicleId, message: 'Veículo não encontrado' });
        return;
      }
      socket.join(`vehicle_${vehicleId}`);
    });

    socket.on('unsubscribe_vehicle', (vehicleId: string) => {
      socket.leave(`vehicle_${vehicleId}`);
    });

    socket.on('disconnect', () => {
      // nothing special for now
    });
  });

  // MQTT client
  // If no mqttUrl provided, skip connecting to avoid unauthorized/connect errors
  if (!mqttUrl) {
    console.log('🔕 MQTT disabled: no MQTT_URL configured. To enable, set MQTT_URL in environment variables.');
    return { io, mqttClient: null } as any;
  }

  const mqttOptions: mqtt.IClientOptions = {};
  if (mqttUser) mqttOptions.username = mqttUser;
  if (mqttPass) mqttOptions.password = mqttPass;

  const client: MqttClient = mqtt.connect(mqttUrl, mqttOptions);

  client.on('connect', () => {
    console.log('🔗 Conectado ao broker MQTT em', mqttUrl);
    // subscribe to vehicle sensor topics
    client.subscribe('vehicle/+/sensor/+', { qos: 0 }, (err) => {
      if (err) console.error('Erro ao subscrever tópicos MQTT:', err);
    });

    // subscribe to device presence topics
    client.subscribe('vehicle/+/device/+', { qos: 0 }, (err) => {
      if (err) console.error('Erro ao subscrever tópicos MQTT (devices):', err);
    });
  });

  client.on('message', (topic, payload) => {
    try {
      const str = payload.toString();
      const data = JSON.parse(str);

      // topic like vehicle/{vehicleId}/sensor/{sensor}
      const parts = topic.split('/');
      if (parts.length >= 4 && parts[0] === 'vehicle') {
        const vehicleId = parts[1];
        const kind = parts[2];
        const name = parts.slice(3).join('/');

        if (kind === 'sensor') {
          // emit to clients in room vehicle_{vehicleId}
          io.to(`vehicle_${vehicleId}`).emit('iot:sensor', { vehicleId, sensor: name, data });
        }

        if (kind === 'device') {
          io.to(`vehicle_${vehicleId}`).emit('iot:device', { vehicleId, device: name, data });
        }
      }
    } catch (err) {
      console.error('Erro ao processar mensagem MQTT:', err);
    }
  });

  client.on('error', (err) => console.error('MQTT error:', err));

  return { io, mqttClient: client };
}
