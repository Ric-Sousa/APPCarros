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
import { requireAuth, requireVehicle, requireOwner, requireFeature, currentPlan, userId, HttpError, PlanLimitError, uploads, removeUpload, isOwnVehiclePhoto, limiter } from '../http';
import { randomBytes } from 'crypto';
import { suggestIucDue, suggestInspectionDue, nextDeadlineAfter } from '@shared/deadlines';
import { BRAND } from '@shared/brand';
import { consumptionL100, monthlyExpenses } from '@shared/calc';
import { vehicleKind } from '../services/vehicleImage';
import { hashToken } from '../session';
import { persistUpload } from '../files';
import { sendMail, appUrl } from '../services/mailer';
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
    const plan = await currentPlan(req);
    if (plan.maxVehicles !== null && (await storage.getOwnedVehicles(userId(req))).length >= plan.maxVehicles) {
      throw new PlanLimitError('vehicles', `O plano ${plan.name} inclui ${plan.maxVehicles} veículo. Mude de plano para adicionar mais.`);
    }
    // Prazos sugeridos a partir da data da matrícula (o utilizador pode corrigir depois)
    if (data.registrationDate) {
      data.iucDue ??= suggestIucDue(data.registrationDate) ?? undefined;
      const kind = vehicleKind(data);
      data.inspectionDue ??= suggestInspectionDue(data.registrationDate, kind) ?? undefined;
    }
    try {
      const vehicle = await storage.createVehicle({ ...data, userId: userId(req) });
      await storage.trackEvent(userId(req), 'vehicle_created');
      res.status(201).json(vehicle);
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
    if ((data.imageUrl !== undefined || data.imageCredit !== undefined) && req.vehicle!.role !== 'owner') {
      throw new HttpError(403, 'Só o dono do veículo pode mudar a foto.');
    }
    try {
      const updated = await storage.updateVehicle(req.vehicle!.id, data);
      if (data.imageUrl !== undefined) await removeUnusedPhoto(req.vehicle!.imageUrl);
      res.json(updated);
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new HttpError(409, 'Já tem um veículo com esta matrícula.');
      throw error;
    }
  });

  app.delete('/api/vehicles/:id', requireAuth, requireVehicle, requireOwner, async (req, res) => {
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
  app.post('/api/vehicle-photos', requireAuth, limiter(30, 'envios de fotos'), uploads.vehiclePhoto.single('image'), async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Nenhum ficheiro enviado');
    await persistUpload(req.file);
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

  // "Lembrar mais tarde": esconde o alerta durante 1 a 30 dias
  app.post('/api/alerts/:id/snooze', requireAuth, async (req, res) => {
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(30) }).parse(req.body);
    const alert = await storage.getUserAlert(String(req.params.id), userId(req));
    if (!alert) throw new HttpError(404, 'Alerta não encontrado');
    await storage.snoozeAlert(alert.id, new Date(Date.now() + days * 86_400_000));
    res.status(204).send();
  });

  // "Feito": atualiza o próximo prazo do veículo (e regista a manutenção, no caso do óleo e dos pneus)
  app.post('/api/alerts/:id/done', requireAuth, async (req, res) => {
    const alert = await storage.getUserAlert(String(req.params.id), userId(req));
    if (!alert) throw new HttpError(404, 'Alerta não encontrado');
    const vehicle = await storage.getUserVehicle(userId(req), alert.vehicleId);
    if (!vehicle) throw new HttpError(404, 'Veículo não encontrado');
    const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const kind = vehicleKind(vehicle);
    let changes: Record<string, unknown> = {};
    switch (alert.type) {
      case 'iuc': changes = { iucDue: nextDeadlineAfter('iuc', vehicle.iucDue ?? today) }; break;
      case 'insurance': changes = { insuranceDue: nextDeadlineAfter('insurance', vehicle.insuranceDue ?? today) }; break;
      case 'inspection': changes = { inspectionDue: nextDeadlineAfter('inspection', vehicle.inspectionDue ?? today, vehicle.registrationDate, kind) }; break;
      case 'oil_change':
        changes = { lastOilChangeMileage: vehicle.currentMileage, lastOilChange: today };
        await storage.createMaintenanceRecord({ vehicleId: vehicle.id, type: 'oil_change', description: 'Mudança de óleo (marcada como feita no alerta)', mileage: vehicle.currentMileage, performedAt: today });
        break;
      case 'tire_change':
        changes = { lastTireChangeMileage: vehicle.currentMileage, lastTireChange: today };
        await storage.createMaintenanceRecord({ vehicleId: vehicle.id, type: 'tire_change', description: 'Troca de pneus (marcada como feita no alerta)', mileage: vehicle.currentMileage, performedAt: today });
        break;
      default: throw new HttpError(400, 'Este alerta não tem ação automática.');
    }
    const updated = await storage.updateVehicle(vehicle.id, changes);
    await storage.syncAlerts(userId(req));
    await storage.trackEvent(userId(req), 'alert_done');
    res.json({ vehicle: updated });
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

  // ---------- Partilha (família / condutores) ----------
  app.get('/api/vehicles/:id/members', requireAuth, requireVehicle, requireOwner, async (req, res) => {
    res.json(await storage.listMembers(req.vehicle!.id));
  });

  app.post('/api/vehicles/:id/members', requireAuth, requireVehicle, requireOwner,
    requireFeature('sharing', 'A partilha de veículos está incluída no plano Premium.'), limiter(20, 'convites', 60 * 60 * 1000),
    async (req, res) => {
      const { email } = z.object({ email: z.string().trim().toLowerCase().pipe(z.email('Email inválido')) }).parse(req.body);
      const me = await storage.getUser(userId(req));
      if (me?.email === email) throw new HttpError(400, 'Não se pode convidar a si próprio.');
      const token = randomBytes(32).toString('base64url');
      let memberId: string;
      try {
        memberId = await storage.upsertInvite(req.vehicle!.id, email, userId(req), hashToken(token));
      } catch (error) {
        if ((error as Error).message === 'ALREADY_MEMBER') throw new HttpError(409, 'Esta pessoa já tem acesso ao veículo.');
        throw error;
      }
      const v = req.vehicle!;
      const inviter = [me?.firstName, me?.lastName].filter(Boolean).join(' ') || me?.email || 'Um utilizador';
      await sendMail({
        to: email,
        subject: `${inviter} partilhou um veículo consigo · ${BRAND.name}`,
        paragraphs: [
          `${inviter} convidou-o para acompanhar o ${v.brand} ${v.model} (${v.licensePlate}) no ${BRAND.name}.`,
          'Vai poder registar abastecimentos, despesas e manutenções, e receber os lembretes dos prazos deste veículo.',
        ],
        action: { label: 'Aceitar convite', url: appUrl(`/convite?token=${encodeURIComponent(token)}`) },
        footer: ['Se não conhece quem enviou o convite, ignore este email.'],
      });
      res.status(201).json({ id: memberId });
    });

  // O dono remove um membro, ou o próprio membro deixa de acompanhar o veículo
  app.delete('/api/vehicles/:id/members/:memberId', requireAuth, requireVehicle, async (req, res) => {
    const v = req.vehicle!;
    let memberId = String(req.params.memberId);
    // "me": o condutor deixa de acompanhar o veículo sem precisar de saber o id do convite
    if (memberId === 'me') {
      const mine = await storage.findMembership(v.id, userId(req));
      if (!mine) throw new HttpError(404, 'Não é membro deste veículo.');
      memberId = mine.id as string;
    }
    if (v.role !== 'owner') {
      const mine = await storage.findMembership(v.id, userId(req));
      if (mine?.id !== memberId) throw new HttpError(403, 'Só o dono do veículo pode remover outras pessoas.');
    }
    if (!await storage.removeMember(v.id, memberId)) throw new HttpError(404, 'Membro não encontrado');
    res.status(204).send();
  });

  app.get('/api/invites/:token', requireAuth, async (req, res) => {
    const invite = await storage.findInvite(hashToken(String(req.params.token)));
    if (!invite) throw new HttpError(404, 'Convite inválido ou já usado.');
    const { brand, model, licensePlate } = invite.vehicle;
    res.json({ vehicle: { brand, model, licensePlate }, invitedBy: invite.invitedBy });
  });

  app.post('/api/invites/accept', requireAuth, async (req, res) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    const invite = await storage.findInvite(hashToken(token));
    if (!invite) throw new HttpError(404, 'Convite inválido ou já usado.');
    if (invite.vehicle.userId === userId(req)) throw new HttpError(400, 'Este veículo já é seu.');
    await storage.acceptInvite(invite.memberId, userId(req));
    await storage.trackEvent(userId(req), 'invite_accepted');
    res.json({ vehicleId: invite.vehicle.id });
  });

  // ---------- Relatórios ----------
  // Dados do livro de revisões (o cliente gera o PDF com a impressão do browser)
  app.get('/api/vehicles/:id/report', requireAuth, requireVehicle,
    requireFeature('pdfReport', 'O livro de revisões em PDF está incluído no plano Premium.'),
    async (req, res) => {
      res.json(await storage.vehicleReport(req.vehicle!));
    });

  // Relatório da frota em CSV (plano Empresas)
  app.get('/api/reports/fleet.csv', requireAuth, requireFeature('fleetReport', 'O relatório da frota está incluído no plano Empresas.'), async (req, res) => {
    const vehicles = await storage.getUserVehicles(userId(req));
    const since = Date.now() - 365 * 86_400_000;
    const rows = await Promise.all(vehicles.map(async (v) => {
      const [fuel, expenses, maintenance] = await Promise.all([storage.getFuelRecords(v.id), storage.getVehicleExpenses(v.id), storage.getMaintenanceRecords(v.id)]);
      const lastYear = <T extends { date?: Date | string; performedAt?: Date | string }>(xs: T[]) => xs.filter((x) => new Date((x.date ?? x.performedAt)!).getTime() >= since);
      const sum = (xs: (string | number | null | undefined)[]) => xs.reduce<number>((a, b) => a + Number(b ?? 0), 0);
      return [
        v.licensePlate, v.brand, v.model, v.year, v.currentMileage,
        consumptionL100(fuel) ?? '',
        sum(lastYear(fuel).map((f) => f.totalCost)).toFixed(2),
        sum(lastYear(maintenance).map((m) => m.cost)).toFixed(2),
        sum(lastYear(expenses).map((e) => e.amount)).toFixed(2),
        monthlyExpenses(expenses).toFixed(2),
        v.inspectionDue ? new Date(v.inspectionDue).toISOString().slice(0, 10) : '',
        v.iucDue ? new Date(v.iucDue).toISOString().slice(0, 10) : '',
        v.insuranceDue ? new Date(v.insuranceDue).toISOString().slice(0, 10) : '',
      ];
    }));
    const header = ['Matrícula', 'Marca', 'Modelo', 'Ano', 'Km', 'Consumo (L/100km)', 'Combustível 12m (€)', 'Manutenção 12m (€)', 'Despesas 12m (€)', 'Média mensal despesas (€)', 'Inspeção', 'IUC', 'Seguro'];
    const esc = (x: unknown) => { const t = String(x ?? ''); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const csv = '\uFEFF' + [header, ...rows].map((r) => r.map((c) => esc(String(c).replace(/^(\d+)\.(\d+)$/, '$1,$2'))).join(';')).join('\r\n');
    res.setHeader('Content-Disposition', `attachment; filename="frota-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.type('text/csv; charset=utf-8').send(csv);
  });

  app.get('/api/stats/fleet-comparison', requireAuth, async (req, res) => {
    res.json(await storage.getFleetComparison(userId(req)));
  });
}
