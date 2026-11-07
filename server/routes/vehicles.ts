import type { Express } from 'express';
import { z } from 'zod';
import {
  createVehicleSchema,
  updateVehicleSchema,
  createMaintenanceRecordSchema,
  createMaintenanceAppointmentSchema,
  updateMaintenanceAppointmentSchema,
} from '@shared/schema';
import { storage } from '../storage';
import { requireAuth, requireVehicle, userId, HttpError, uploads, removeUpload, isOwnVehiclePhoto, limiter } from '../http';
import { isDuplicateKeyError } from '../db';
import { predictiveRisk } from '../stats';
import { getVehicleByLicensePlate } from '../services/vehicleApi';
import { getImageSuggestions, trackUnsplashUse } from '../services/vehicleImage';
import { VehicleSpecsService } from '../services/vehicleSpecs';

// Cada consulta de matrícula abre um Chrome headless no serviço PHP
const plateLimiter = limiter(20, 'consultas de matrícula');
// Cada pedido de sugestões faz até 3 pesquisas no Wikimedia Commons e 1 no Unsplash
const photoLimiter = limiter(30, 'pesquisas de fotos');

const suggestionsQuery = z.object({
  brand: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  engineDisplacement: z.coerce.number().int().positive().max(20000).optional(),
  vehicleCategory: z.string().max(100).optional(),
  iucCategory: z.string().max(100).optional(),
});

const oilIntervalBody = z.object({
  oilBrand: z.string().trim().min(1).max(100),
  vehicleBrand: z.string().trim().min(1).max(100),
  vehicleModel: z.string().trim().min(1).max(100),
});

/** Apaga fotos próprias que deixaram de ser usadas por qualquer veículo. */
async function removeUnusedPhoto(url: string | null | undefined) {
  if (isOwnVehiclePhoto(url) && (await storage.photoUsage(url!)) === 0) removeUpload(url!);
}

export function registerVehicleRoutes(app: Express) {
  // ---------- Veículos ----------
  app.get('/api/vehicles', requireAuth, async (req, res) => {
    res.json(await storage.getUserVehicles(userId(req)));
  });

  app.post('/api/vehicles', requireAuth, async (req, res) => {
    const data = createVehicleSchema.parse(req.body);
    try {
      res.status(201).json(await storage.createVehicle({ ...data, userId: userId(req) }));
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new HttpError(409, 'Já tem um veículo com esta matrícula.');
      throw error;
    }
  });

  app.get('/api/vehicles/:id', requireAuth, requireVehicle, (req, res) => {
    res.json(req.vehicle);
  });

  app.patch('/api/vehicles/:id', requireAuth, requireVehicle, async (req, res) => {
    const body = { ...req.body };
    // O formulário de edição pode reenviar a foto atual (incluindo fotos antigas em base64): não é uma alteração
    if (body.imageUrl === req.vehicle!.imageUrl) delete body.imageUrl;
    const data = updateVehicleSchema.parse(body);
    try {
      const updated = await storage.updateVehicle(req.vehicle!.id, data);
      if (data.imageUrl !== undefined) await removeUnusedPhoto(req.vehicle!.imageUrl);
      res.json(updated);
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new HttpError(409, 'Já tem um veículo com esta matrícula.');
      throw error;
    }
  });

  app.delete('/api/vehicles/:id', requireAuth, requireVehicle, async (req, res) => {
    const files = await storage.vehicleFiles(req.vehicle!);
    await storage.deleteVehicle(req.vehicle!.id);
    for (const file of files) {
      if (isOwnVehiclePhoto(file)) await removeUnusedPhoto(file);
      else removeUpload(file);
    }
    res.status(204).send();
  });

  app.get('/api/vehicles/:id/predictive-status', requireAuth, requireVehicle, (req, res) => {
    res.json(predictiveRisk(req.vehicle!));
  });

  app.get('/api/vehicles/:vehicleId/compare', requireAuth, requireVehicle, async (req, res) => {
    res.json(await storage.getVehicleComparison(req.vehicle!));
  });

  app.get('/api/vehicle-data/:licensePlate', requireAuth, plateLimiter, async (req, res) => {
    const plate = String(req.params.licensePlate).trim().toUpperCase();
    if (!/^[A-Z0-9-]{5,10}$/.test(plate)) throw new HttpError(400, 'Formato de matrícula inválido.');
    const data = await getVehicleByLicensePlate(plate);
    if (!data) throw new HttpError(404, `Não foram encontrados dados para a matrícula ${plate}.`);
    res.json(data);
  });

  // ---------- Fotos ----------
  app.get('/api/vehicle-photos/suggestions', requireAuth, photoLimiter, async (req, res) => {
    res.json(await getImageSuggestions(suggestionsQuery.parse(req.query)));
  });

  // Foto própria: devolve o URL para usar em imageUrl (na criação ou num PATCH do veículo)
  // ponytail: fotos de veículos que não chegaram a ser criados ficam em uploads/; limpar órfãos se o disco for um problema
  app.post('/api/vehicle-photos', requireAuth, limiter(30, 'envios de fotos'), uploads.vehiclePhoto.single('image'), (req, res) => {
    if (!req.file) throw new HttpError(400, 'Nenhum ficheiro enviado');
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });

  app.post('/api/vehicle-photos/track', requireAuth, async (req, res) => {
    await trackUnsplashUse(String(req.body?.trackUrl ?? ''));
    res.status(204).send();
  });

  // ---------- Especificações ----------
  app.get('/api/autocomplete/:type', requireAuth, (req, res) => {
    const { type } = req.params;
    const q = req.query.q;
    if (typeof q !== 'string' || !q) throw new HttpError(400, "Parâmetro 'q' obrigatório");
    if (type !== 'oil' && type !== 'tire' && type !== 'both') throw new HttpError(400, "O tipo deve ser 'oil', 'tire' ou 'both'");
    res.json(VehicleSpecsService.getAutocomplete(q.slice(0, 100), type));
  });

  app.get('/api/vehicle-specs/:brand/:model', requireAuth, (req, res) => {
    res.json(VehicleSpecsService.getVehicleRecommendations(String(req.params.brand), String(req.params.model)));
  });

  app.post('/api/oil-interval', requireAuth, (req, res) => {
    const { oilBrand, vehicleBrand, vehicleModel } = oilIntervalBody.parse(req.body);
    res.json(VehicleSpecsService.getOilIntervalByBrand(oilBrand, vehicleBrand, vehicleModel));
  });

  // ---------- Manutenção ----------
  // Últimas manutenções de todos os veículos (atividade recente)
  app.get('/api/maintenance', requireAuth, async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    res.json(await storage.getUserMaintenance(userId(req), limit));
  });

  app.get('/api/vehicles/:id/maintenance', requireAuth, requireVehicle, async (req, res) => {
    res.json(await storage.getMaintenanceRecords(req.vehicle!.id));
  });

  app.post('/api/vehicles/:id/maintenance', requireAuth, requireVehicle, async (req, res) => {
    const data = createMaintenanceRecordSchema.parse({ ...req.body, vehicleId: req.vehicle!.id });
    res.status(201).json(await storage.createMaintenanceRecord(data));
  });

  app.get('/api/appointments', requireAuth, async (req, res) => {
    res.json(await storage.getUserAppointments(userId(req)));
  });

  app.get('/api/vehicles/:id/appointments', requireAuth, requireVehicle, async (req, res) => {
    res.json(await storage.getMaintenanceAppointments(req.vehicle!.id));
  });

  app.post('/api/vehicles/:id/appointments', requireAuth, requireVehicle, async (req, res) => {
    const data = createMaintenanceAppointmentSchema.parse({ ...req.body, vehicleId: req.vehicle!.id, userId: userId(req) });
    res.status(201).json(await storage.createMaintenanceAppointment(data));
  });

  app.put('/api/appointments/:id', requireAuth, async (req, res) => {
    const updated = await storage.updateMaintenanceAppointment(req.params.id, userId(req), updateMaintenanceAppointmentSchema.parse(req.body));
    if (!updated) throw new HttpError(404, 'Marcação não encontrada');
    res.json(updated);
  });

  app.delete('/api/appointments/:id', requireAuth, async (req, res) => {
    if (!await storage.deleteMaintenanceAppointment(req.params.id, userId(req))) throw new HttpError(404, 'Marcação não encontrada');
    res.status(204).send();
  });

  // ---------- Alertas e estatísticas ----------
  app.get('/api/alerts', requireAuth, async (req, res) => {
    await storage.syncAlerts(userId(req));
    res.json(await storage.getUserAlerts(userId(req)));
  });

  app.patch('/api/alerts/:id/read', requireAuth, async (req, res) => {
    if (!await storage.updateUserAlert(req.params.id, userId(req), { isRead: true })) throw new HttpError(404, 'Alerta não encontrado');
    res.status(204).send();
  });

  app.patch('/api/alerts/:id/dismiss', requireAuth, async (req, res) => {
    if (!await storage.updateUserAlert(req.params.id, userId(req), { isDismissed: true })) throw new HttpError(404, 'Alerta não encontrado');
    res.status(204).send();
  });

  app.get('/api/stats', requireAuth, async (req, res) => {
    await storage.syncAlerts(userId(req));
    const [vehicles, alerts, trips] = await Promise.all([
      storage.getUserVehicles(userId(req)),
      storage.getUserAlerts(userId(req)),
      storage.getUserMileageTrips(userId(req)),
    ]);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    res.json({
      totalVehicles: vehicles.length,
      totalAlerts: alerts.length,
      urgentAlerts: alerts.filter((a) => a.priority === 'urgent').length,
      // Km das viagens registadas este mês (página de quilometragem)
      monthlyKms: trips.filter((t) => new Date(t.startTime) >= monthStart).reduce((sum, t) => sum + (t.totalDistance ?? 0), 0),
    });
  });

  app.get('/api/stats/fleet-comparison', requireAuth, async (req, res) => {
    res.json(await storage.getFleetComparison(userId(req)));
  });
}
