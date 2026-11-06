import type { Express } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  createVehicleSchema,
  updateVehicleSchema,
  createMaintenanceRecordSchema,
  createMaintenanceAppointmentSchema,
} from '@shared/schema';
import { storage } from '../storage';
import { requireAuth, requireVehicle, userId, HttpError, uploads, removeUpload, isOwnVehiclePhoto } from '../http';
import { predictiveRisk } from '../stats';
import { getVehicleByLicensePlate } from '../services/vehicleApi';
import { getImageSuggestions, trackUnsplashUse } from '../services/vehicleImage';
import { VehicleSpecsService } from '../services/vehicleSpecs';

// Cada consulta de matrícula abre um Chrome headless no serviço PHP: limitar
const plateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

// Cada pedido de sugestões faz até 3 pesquisas no Wikimedia Commons e 1 no Unsplash
const photoLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

const suggestionsQuery = z.object({
  brand: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  engineDisplacement: z.coerce.number().int().positive().max(20000).optional(),
  vehicleCategory: z.string().max(100).optional(),
  iucCategory: z.string().max(100).optional(),
});

const updateAppointmentSchema = createMaintenanceAppointmentSchema.omit({ vehicleId: true, userId: true }).partial();

export function registerVehicleRoutes(app: Express) {
  // ---------- Veículos ----------
  app.get('/api/vehicles', requireAuth, async (req, res) => {
    res.json(await storage.getUserVehicles(userId(req)));
  });

  app.post('/api/vehicles', requireAuth, async (req, res) => {
    const data = createVehicleSchema.parse(req.body);
    res.status(201).json(await storage.createVehicle({ ...data, userId: userId(req) }));
  });

  app.get('/api/vehicles/:id', requireAuth, requireVehicle, (req, res) => {
    res.json(req.vehicle);
  });

  app.patch('/api/vehicles/:id', requireAuth, requireVehicle, async (req, res) => {
    const data = updateVehicleSchema.parse(req.body);
    const updated = await storage.updateVehicle(req.vehicle!.id, data);
    // Trocou de foto: a foto própria antiga deixa de ser usada
    const oldPhoto = req.vehicle!.imageUrl;
    if (data.imageUrl !== undefined && data.imageUrl !== oldPhoto && isOwnVehiclePhoto(oldPhoto)) removeUpload(oldPhoto!);
    res.json(updated);
  });

  app.delete('/api/vehicles/:id', requireAuth, requireVehicle, async (req, res) => {
    await storage.deleteVehicle(req.vehicle!.id);
    if (isOwnVehiclePhoto(req.vehicle!.imageUrl)) removeUpload(req.vehicle!.imageUrl!);
    res.status(204).send();
  });

  app.get('/api/vehicles/:id/predictive-status', requireAuth, requireVehicle, (req, res) => {
    res.json(predictiveRisk(req.vehicle!));
  });

  app.get('/api/vehicles/:vehicleId/compare', requireAuth, requireVehicle, async (req, res) => {
    res.json(await storage.getVehicleComparison(req.vehicle!));
  });

  app.get('/api/vehicle-data/:licensePlate', requireAuth, plateLimiter, async (req, res) => {
    const plate = req.params.licensePlate.trim().toUpperCase();
    if (!/^[A-Z0-9-]{5,10}$/.test(plate)) {
      return res.status(400).json({ message: 'Formato de matrícula inválido.' });
    }
    const data = await getVehicleByLicensePlate(plate);
    if (!data) return res.status(404).json({ message: `Não foram encontrados dados para a matrícula ${plate}.` });
    res.json(data);
  });

  // ---------- Fotos ----------
  app.get('/api/vehicle-photos/suggestions', requireAuth, photoLimiter, async (req, res) => {
    res.json(await getImageSuggestions(suggestionsQuery.parse(req.query)));
  });

  // Foto própria: devolve o URL para usar em imageUrl (na criação ou num PATCH do veículo)
  // ponytail: fotos substituídas ou de veículos que não chegaram a ser criados ficam em uploads/; limpar órfãos se o disco for um problema
  app.post('/api/vehicle-photos', requireAuth, uploads.vehiclePhoto.single('image'), (req, res) => {
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
    if (typeof q !== 'string' || !q) return res.status(400).json({ message: "Parâmetro 'q' obrigatório" });
    if (type !== 'oil' && type !== 'tire' && type !== 'both') {
      return res.status(400).json({ message: "O tipo deve ser 'oil', 'tire' ou 'both'" });
    }
    res.json(VehicleSpecsService.getAutocomplete(q, type));
  });

  app.get('/api/vehicle-specs/:brand/:model', requireAuth, (req, res) => {
    res.json(VehicleSpecsService.getVehicleRecommendations(req.params.brand, req.params.model));
  });

  app.post('/api/oil-interval', requireAuth, (req, res) => {
    const { oilBrand, vehicleBrand, vehicleModel } = req.body ?? {};
    if (!oilBrand || !vehicleBrand || !vehicleModel) {
      return res.status(400).json({ message: 'Marca do óleo, marca e modelo do veículo são obrigatórios' });
    }
    res.json(VehicleSpecsService.getOilIntervalByBrand(String(oilBrand), String(vehicleBrand), String(vehicleModel)));
  });

  // ---------- Manutenção ----------
  app.get('/api/vehicles/:id/maintenance', requireAuth, requireVehicle, async (req, res) => {
    res.json(await storage.getMaintenanceRecords(req.vehicle!.id));
  });

  app.post('/api/vehicles/:id/maintenance', requireAuth, requireVehicle, async (req, res) => {
    const data = createMaintenanceRecordSchema.parse({ ...req.body, vehicleId: req.vehicle!.id });
    res.status(201).json(await storage.createMaintenanceRecord(data));
  });

  app.get('/api/vehicles/:id/appointments', requireAuth, requireVehicle, async (req, res) => {
    res.json(await storage.getMaintenanceAppointments(req.vehicle!.id));
  });

  app.post('/api/vehicles/:id/appointments', requireAuth, requireVehicle, async (req, res) => {
    const data = createMaintenanceAppointmentSchema.parse({ ...req.body, vehicleId: req.vehicle!.id, userId: userId(req) });
    res.status(201).json(await storage.createMaintenanceAppointment(data));
  });

  app.put('/api/appointments/:id', requireAuth, async (req, res) => {
    const updated = await storage.updateMaintenanceAppointment(req.params.id, userId(req), updateAppointmentSchema.parse(req.body));
    if (!updated) throw new HttpError(404, 'Marcação não encontrada');
    res.json(updated);
  });

  app.delete('/api/appointments/:id', requireAuth, async (req, res) => {
    if (!await storage.deleteMaintenanceAppointment(req.params.id, userId(req))) throw new HttpError(404, 'Marcação não encontrada');
    res.status(204).send();
  });

  // ---------- Alertas e estatísticas ----------
  app.get('/api/alerts', requireAuth, async (req, res) => {
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
    const [vehicles, alerts, trips] = await Promise.all([
      storage.getUserVehicles(userId(req)),
      storage.getUserAlerts(userId(req)),
      storage.getUserMileageTrips(userId(req)),
    ]);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
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
