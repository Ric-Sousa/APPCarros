import type { Express } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { createChargingStationReservationSchema } from '@shared/schema';
import { storage } from '../storage';
import { requireAuth, requireVehicle, ownedVehicle, userId, HttpError } from '../http';
import { consumptionL100 } from '../stats';
import * as external from '../services/externalApis';

const updateReservationSchema = createChargingStationReservationSchema.omit({ vehicleId: true, userId: true }).partial();

const coord = z.coerce.number().refine(Number.isFinite, 'Coordenada inválida');
// Campos numéricos opcionais: null, '' e NaN (parseFloat de campo vazio) contam como ausentes
const optionalNumber = <T extends z.ZodType<number>>(schema: T) =>
  z.preprocess((v) => (v === null || v === '' || Number.isNaN(v) ? undefined : v), schema.optional());

const routePlannerSchema = z.object({
  originLat: coord,
  originLon: coord,
  destinationLat: coord,
  destinationLon: coord,
  vehicleId: z.string().min(1),
  energyType: z.enum(['gasoline', 'diesel', 'electric']),
  consumption: z.coerce.number().positive(),
  capacity: optionalNumber(z.coerce.number().nonnegative()),
  currentLevelPercent: optionalNumber(z.coerce.number().min(0).max(100)),
});

const routePlanSchema = z.object({
  vehicleId: z.string().min(1),
  originLat: coord,
  originLon: coord,
  destinationLat: coord,
  destinationLon: coord,
}).loose();

// Campos que nunca podem ser alterados num plano guardado
const routePlanUpdateSchema = z.record(z.string(), z.unknown()).transform(({ id, userId, vehicleId, createdAt, updatedAt, ...rest }) => rest);

// ponytail: valores de referência fixos (marcados como demo); trocar por uma base de dados de modelos EV se for preciso escolher modelos
const REFERENCE_EV = { model: 'Hyundai Kona Electric 65 kWh', price: 42000, range: 514, kWhPer100: 14.7, incentives: 4000 };
const ELECTRICITY_PRICE = 0.2; // €/kWh, tarifa doméstica de referência
const GRID_CO2_KG_PER_KWH = 0.15; // intensidade média da rede em Portugal (referência)

const ocmKey = () => process.env.OPENCHARGEMMAP_API_KEY;

export function registerMobilityRoutes(app: Express) {
  // ---------- Postos de carregamento ----------
  app.get('/api/charging-stations', requireAuth, async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Math.min(100, Math.max(1, Number(req.query.radius) || 10));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: 'Latitude e longitude são obrigatórias' });
    }
    const key = ocmKey();
    if (!key) return res.status(503).json({ message: 'Chave da API OpenChargeMap não configurada' });

    const params = new URLSearchParams({
      latitude: String(lat), longitude: String(lng), distance: String(radius), distanceunit: 'KM',
      maxresults: '50', compact: 'true', verbose: 'false', countrycode: 'PT', key,
    });
    const response = await fetch(`https://api.openchargemap.io/v3/poi?${params}`, {
      headers: { 'User-Agent': 'LogiCar/1.0' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new HttpError(502, `Erro na API OpenChargeMap (${response.status})`);
    const data: any[] = await response.json();

    const stations = data.map((s) => {
      const position = { lat: s.AddressInfo?.Latitude ?? 0, lng: s.AddressInfo?.Longitude ?? 0 };
      const connections: any[] = s.Connections ?? [];
      return {
        id: String(s.ID),
        name: s.AddressInfo?.Title || 'Posto de Carregamento',
        address: [s.AddressInfo?.AddressLine1, s.AddressInfo?.Town, s.AddressInfo?.StateOrProvince].filter(Boolean).join(', '),
        lat: position.lat,
        lng: position.lng,
        distance: Math.round(external.haversineKm({ lat, lng }, position) * 10) / 10,
        connectorTypes: [...new Set(connections.map((c) => c.ConnectionType?.Title || 'Desconhecido'))],
        power: Math.max(0, ...connections.map((c) => c.PowerKW || 0)),
        available: s.StatusType?.ID === 50 ? (s.NumberOfPoints || 1) : 0,
        total: s.NumberOfPoints || 1,
        price: null,
        network: s.OperatorInfo?.Title || 'Desconhecido',
        amenities: [],
        status: s.StatusType?.Title || 'Desconhecido',
        usageCost: s.UsageCost || null,
        access24Hours: s.OperatorInfo?.Is24Hours || false,
      };
    }).filter((s) => s.distance <= radius).sort((a, b) => a.distance - b.distance);

    res.json(stations);
  });

  // ---------- Reservas de carregamento ----------
  app.get('/api/vehicles/:id/reservations', requireAuth, requireVehicle, async (req, res) => {
    res.json(await storage.getChargingStationReservations(req.vehicle!.id));
  });

  app.post('/api/vehicles/:id/reservations', requireAuth, requireVehicle, async (req, res) => {
    const data = createChargingStationReservationSchema.parse({ ...req.body, vehicleId: req.vehicle!.id, userId: userId(req) });
    res.status(201).json(await storage.createChargingStationReservation(data));
  });

  app.put('/api/reservations/:id', requireAuth, async (req, res) => {
    const updated = await storage.updateChargingStationReservation(req.params.id, userId(req), updateReservationSchema.parse(req.body));
    if (!updated) throw new HttpError(404, 'Reserva não encontrada');
    res.json(updated);
  });

  app.delete('/api/reservations/:id', requireAuth, async (req, res) => {
    if (!await storage.deleteChargingStationReservation(req.params.id, userId(req))) throw new HttpError(404, 'Reserva não encontrada');
    res.status(204).send();
  });

  // ---------- Comparação com um veículo elétrico ----------
  app.post('/api/ev-comparison', requireAuth, async (req, res) => {
    const { vehicleId, monthlyKm, currentFuelPrice } = z.object({
      vehicleId: z.string().min(1),
      monthlyKm: z.coerce.number().positive().max(20000).default(1000),
      currentFuelPrice: z.coerce.number().positive().max(10).default(1.65),
    }).parse(req.body);
    const vehicle = await ownedVehicle(req, vehicleId);
    const isDiesel = /diesel|gasóleo/i.test(vehicle.fuelType ?? '');

    // Consumo real a partir dos abastecimentos; sem registos, valor típico
    const consumption = consumptionL100(await storage.getFuelRecords(vehicle.id)) ?? (isDiesel ? 5.5 : 6.5);
    const litres = (monthlyKm / 100) * consumption;
    const kWh = (monthlyKm / 100) * REFERENCE_EV.kWhPer100;

    const current = {
      fuelCostPerMonth: Math.round(litres * currentFuelPrice),
      maintenanceCost: 60,
      co2EmissionsPerMonth: Math.round(litres * (isDiesel ? 2.68 : 2.31)),
    };
    const electric = {
      model: REFERENCE_EV.model,
      price: REFERENCE_EV.price,
      range: REFERENCE_EV.range,
      chargingCost: Math.round(kWh * ELECTRICITY_PRICE),
      maintenanceCost: 30,
      co2Emissions: Math.round(kWh * GRID_CO2_KG_PER_KWH),
      incentives: REFERENCE_EV.incentives,
    };
    const monthlySavings = current.fuelCostPerMonth + current.maintenanceCost - electric.chargingCost - electric.maintenanceCost;

    res.json({
      success: true,
      demo: true,
      data: {
        currentVehicle: current,
        electricAlternative: electric,
        paybackPeriod: monthlySavings > 0 ? Math.round((electric.price - electric.incentives) / monthlySavings) : null,
        totalSavings5Years: Math.round(monthlySavings * 60),
      },
      message: 'Comparação calculada com valores de referência',
    });
  });

  // ---------- Planeador de rotas ----------
  app.post('/api/route-planner', requireAuth, async (req, res) => {
    const input = routePlannerSchema.parse(req.body);
    await ownedVehicle(req, input.vehicleId);

    const origin = { lat: input.originLat, lng: input.originLon };
    const destination = { lat: input.destinationLat, lng: input.destinationLon };
    const route = await external.getRouteByCoords(origin, destination);
    const totalDistanceKm = route.distanceKm;

    const needed = (totalDistanceKm / 100) * input.consumption;
    const pricePerUnit = { gasoline: 1.75, diesel: 1.65, electric: 0.2 }[input.energyType];
    const capacity = input.capacity ?? 0;
    const level = input.currentLevelPercent ?? 100;
    const availableRangeKm = capacity > 0 ? Number((((capacity * 100) / input.consumption) * level / 100).toFixed(2)) : null;
    const needsStop = availableRangeKm != null && availableRangeKm < totalDistanceKm;
    const midpoint = { lat: (origin.lat + destination.lat) / 2, lon: (origin.lng + destination.lng) / 2 };
    const distanceToMid = (lat: number, lon: number) => Number(external.haversineKm({ lat: midpoint.lat, lng: midpoint.lon }, { lat, lng: lon }).toFixed(2));

    const stops: unknown[] = [];
    if (needsStop) {
      try {
        if (input.energyType === 'electric') {
          const params = new URLSearchParams({
            output: 'json', countrycode: 'PT', latitude: String(midpoint.lat), longitude: String(midpoint.lon),
            distance: '30', distanceunit: 'KM', maxresults: '20', ...(ocmKey() ? { key: ocmKey()! } : {}),
          });
          const json: any[] = await (await fetch(`https://api.openchargemap.io/v3/poi/?${params}`, { signal: AbortSignal.timeout(15_000) })).json();
          const deficitKwh = ((totalDistanceKm - availableRangeKm!) / 100) * input.consumption;
          const suggested = (json ?? []).map((s) => {
            const a = s.AddressInfo ?? {};
            const power = s.Connections?.[0]?.PowerKW || null;
            return {
              id: s.ID,
              name: a.Title || 'Estação de Carregamento',
              address: [a.AddressLine1, a.Town, a.Postcode].filter(Boolean).join(', '),
              distance: distanceToMid(a.Latitude, a.Longitude),
              power,
              connectorTypes: (s.Connections ?? []).map((c: any) => c.ConnectionType?.Title).filter(Boolean),
              total: s.NumberOfPoints || 1,
              network: s.OperatorInfo?.Title || 'Desconhecido',
              status: s.StatusType?.Title || 'Desconhecido',
              usageCost: s.UsageCost || null,
              lat: a.Latitude,
              lon: a.Longitude,
              ...(power ? { estimatedChargingTimeMin: Math.max(0, Math.round((deficitKwh / power) * 60)) } : {}),
            };
          }).sort((a, b) => a.distance - b.distance).slice(0, 5);
          stops.push({ type: 'charging', suggested });
        } else {
          const query = `[out:json][timeout:25];nwr["amenity"="fuel"](around:30000,${midpoint.lat},${midpoint.lon});out center tags;`;
          const json = await (await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query, signal: AbortSignal.timeout(30_000) })).json();
          const suggested = (json?.elements ?? []).map((el: any) => {
            const c = el.center ?? el;
            return {
              id: `${el.type}/${el.id}`,
              name: el.tags?.name || 'Posto de Combustível',
              brand: el.tags?.brand,
              address: [el.tags?.['addr:street'], el.tags?.['addr:housenumber'], el.tags?.['addr:city']].filter(Boolean).join(', '),
              distance: distanceToMid(c.lat, c.lon),
              lat: c.lat,
              lon: c.lon,
            };
          }).sort((a: any, b: any) => a.distance - b.distance).slice(0, 5);
          stops.push({ type: 'fuel', suggested });
        }
      } catch (error) {
        console.error('Erro ao procurar postos para paragem:', error);
      }
    }

    res.json({
      totalDistanceKm,
      durationMin: route.durationMin,
      estimatedUnits: Number(needed.toFixed(2)),
      estimatedCost: Number((needed * pricePerUnit).toFixed(2)),
      energyType: input.energyType,
      consumption: input.consumption,
      capacity: capacity || null,
      currentLevelPercent: level,
      availableRangeKm,
      needsStop,
      midpoint,
      geometry: route.geometry ?? null,
      stops,
    });
  });

  app.get('/api/geocode', requireAuth, async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (!q) return res.status(400).json({ message: 'Parâmetro q (endereço) é obrigatório' });
    res.json({ results: await external.geocodeText(q) });
  });

  app.get('/api/route-plans', requireAuth, async (req, res) => {
    res.json({ plans: await storage.getRoutePlans(userId(req)) });
  });

  app.post('/api/route-plans', requireAuth, async (req, res) => {
    const { vehicleId, ...plan } = routePlanSchema.parse(req.body);
    await ownedVehicle(req, vehicleId);
    const { id: _id, userId: _userId, ...data } = plan as Record<string, unknown>;
    res.json({ success: true, id: await storage.createRoutePlan(userId(req), vehicleId, data) });
  });

  app.put('/api/route-plans/:id', requireAuth, async (req, res) => {
    if (!await storage.updateRoutePlan(req.params.id, userId(req), routePlanUpdateSchema.parse(req.body))) {
      throw new HttpError(404, 'Plano não encontrado');
    }
    res.json({ success: true });
  });

  app.delete('/api/route-plans/:id', requireAuth, async (req, res) => {
    if (!await storage.deleteRoutePlan(req.params.id, userId(req))) throw new HttpError(404, 'Plano não encontrado');
    res.status(204).send();
  });

  // ---------- Recomendações ----------
  const location = (q: unknown) => (typeof q === 'string' && q.trim() ? q.trim() : process.env.DEFAULT_LOCATION || 'Lisboa');

  app.get('/api/external/fuel-prices', requireAuth, (_req, res) => {
    const { data, demo } = external.getFuelPrices();
    res.json({ success: true, demo, data, message: 'Preços de combustível de referência' });
  });

  app.get('/api/external/weather-impact', requireAuth, async (req, res) => {
    const where = location(req.query.location);
    const { data, demo } = await external.getWeatherImpact(where);
    res.json({ success: true, demo, data, message: `Impacto meteorológico para ${where}` });
  });

  app.get('/api/external/traffic-optimization', requireAuth, async (req, res) => {
    const { origin, destination } = req.query;
    if (typeof origin !== 'string' || typeof destination !== 'string' || !origin || !destination) {
      return res.status(400).json({ success: false, message: 'Origem e destino são obrigatórios' });
    }
    const { data, demo } = await external.getTrafficOptimization(origin, destination);
    res.json({ success: true, demo, data, message: `Rota: ${origin} → ${destination}` });
  });

  app.get('/api/external/maintenance-prices/:brand/:model', requireAuth, (req, res) => {
    const { data, demo } = external.getMaintenancePrices();
    res.json({ success: true, demo, data, message: `Preços de manutenção de referência para ${req.params.brand} ${req.params.model}` });
  });

  app.get('/api/external/ai-recommendations/:vehicleId', requireAuth, requireVehicle, (req, res) => {
    const v = req.vehicle!;
    res.json({ success: true, demo: false, data: external.getRecommendations(v), message: `Recomendações para ${v.brand} ${v.model}` });
  });

  app.get('/api/external/enhanced-recommendations/:vehicleId', requireAuth, requireVehicle, async (req, res) => {
    const v = req.vehicle!;
    const { data, demo } = await external.getEnhancedRecommendations(v, location(req.query.location));
    res.json({ success: true, demo, data, vehicle: { brand: v.brand, model: v.model, year: v.year }, message: 'Recomendações do veículo' });
  });

  // ---------- IoT ----------
  // ponytail: não há registo de dispositivos na BD; a lista é de demonstração e os dados reais chegam por MQTT/Socket.IO
  app.get('/api/vehicles/:vehicleId/iot-devices', requireAuth, requireVehicle, (_req, res) => {
    const now = new Date().toISOString();
    res.json([
      { id: '1', name: 'Sistema de Diagnóstico OBD-II', type: 'diagnostic', status: 'connected', lastUpdate: now, batteryLevel: 85, demo: true },
      { id: '2', name: 'Monitor de Pressão dos Pneus', type: 'tire_pressure', status: 'connected', lastUpdate: now, batteryLevel: 92, demo: true },
      { id: '3', name: 'Sensor de Temperatura do Motor', type: 'temperature', status: 'connected', lastUpdate: now, batteryLevel: 78, demo: true },
    ]);
  });

  app.get('/api/vehicles/:vehicleId/sensor-data', requireAuth, requireVehicle, (_req, res) => {
    const now = new Date().toISOString();
    res.json([
      { id: '1', deviceId: '1', type: 'engine_temperature', value: 85, unit: '°C', timestamp: now, status: 'normal', demo: true },
      { id: '2', deviceId: '2', type: 'tire_pressure_fl', value: 32, unit: 'PSI', timestamp: now, status: 'normal', demo: true },
      { id: '3', deviceId: '2', type: 'tire_pressure_fr', value: 31, unit: 'PSI', timestamp: now, status: 'warning', demo: true },
      { id: '4', deviceId: '3', type: 'coolant_temperature', value: 90, unit: '°C', timestamp: now, status: 'normal', demo: true },
    ]);
  });

  app.post('/api/vehicles/:vehicleId/scan-devices', requireAuth, requireVehicle, (_req, res) => {
    res.json({ message: 'Pesquisa de dispositivos iniciada', scanId: randomUUID(), estimatedDuration: 10000, demo: true });
  });
}
