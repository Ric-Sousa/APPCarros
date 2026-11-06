import express, { type Express } from 'express';
import path from 'path';
import fs from 'fs';
import {
  createFuelRecordSchema,
  updateFuelRecordSchema,
  createExpenseRecordSchema,
  createDocumentSchema,
  createMileageTripSchema,
  updateMileageTripSchema,
} from '@shared/schema';
import { storage } from '../storage';
import { requireAuth, requireVehicle, ownedVehicle, userId, uploads, UPLOAD_DIR, HttpError, tokenFromHeader, removeUpload } from '../http';
import { parseImage, parsePdf, buildExpensePayload } from '../services/ocrService';


export function registerRecordRoutes(app: Express) {
  // ---------- Ficheiros enviados ----------
  // Fotos de perfil e de veículos são públicas (para poderem ir num <img>); o resto só para o dono, com o token no header Authorization.
  app.use('/uploads', async (req, res, next) => {
    const name = path.basename(req.path);
    if (name.startsWith('profile-') || name.startsWith('vehicle-')) return next();
    const user = tokenFromHeader(req);
    if (!user) return res.status(401).json({ message: 'Token obrigatório para aceder a ficheiros.' });
    const owns = name.startsWith(`${user.sub}-`) || await storage.userOwnsUpload(user.sub, name);
    if (!owns) return res.status(404).json({ message: 'Ficheiro não encontrado' });
    next();
  }, express.static(UPLOAD_DIR, {
    setHeaders: (res) => res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'"),
  }));

  // ---------- Combustível ----------
  app.get('/api/fuel-records', requireAuth, async (req, res) => {
    if (req.query.vehicleId) {
      const vehicle = await ownedVehicle(req, req.query.vehicleId);
      return res.json(await storage.getFuelRecords(vehicle.id));
    }
    res.json(await storage.getUserFuelRecords(userId(req)));
  });

  app.post('/api/fuel-records', requireAuth, async (req, res) => {
    const data = createFuelRecordSchema.parse(req.body);
    await ownedVehicle(req, data.vehicleId);
    res.status(201).json(await storage.createFuelRecord(data));
  });

  app.put('/api/fuel-records/:id', requireAuth, async (req, res) => {
    const record = await storage.getUserFuelRecord(req.params.id, userId(req));
    if (!record) throw new HttpError(404, 'Registo não encontrado');
    res.json(await storage.updateFuelRecord(record.id, updateFuelRecordSchema.parse(req.body)));
  });

  app.delete('/api/fuel-records/:id', requireAuth, async (req, res) => {
    const record = await storage.getUserFuelRecord(req.params.id, userId(req));
    if (!record) throw new HttpError(404, 'Registo não encontrado');
    await storage.deleteFuelRecord(record.id);
    res.status(204).send();
  });

  // ---------- Despesas ----------
  app.get('/api/expenses', requireAuth, async (req, res) => {
    if (req.query.vehicleId) {
      const vehicle = await ownedVehicle(req, req.query.vehicleId);
      return res.json(await storage.getVehicleExpenses(vehicle.id));
    }
    res.json(await storage.getUserExpenses(userId(req)));
  });

  app.post('/api/expenses', requireAuth, async (req, res) => {
    const data = createExpenseRecordSchema.parse(req.body);
    await ownedVehicle(req, data.vehicleId);
    res.status(201).json(await storage.createExpense(data));
  });

  // Despesa a partir de um recibo (imagem ou PDF) com OCR
  app.post('/api/expenses/ocr', requireAuth, uploads.receipt.single('receipt'), async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, 'Nenhum ficheiro enviado');
    try {
      const vehicle = await ownedVehicle(req, req.body?.vehicleId);
      const parsed = file.mimetype === 'application/pdf' ? await parsePdf(file.path) : await parseImage(file.path);
      const expense = await storage.createExpense(buildExpensePayload({ vehicleId: vehicle.id, receiptUrl: `/uploads/${file.filename}`, parsed }));
      res.status(201).json({
        expense,
        ocr: { vendor: parsed.vendor, totalAmount: parsed.totalAmount, date: parsed.date, description: parsed.description },
      });
    } catch (error) {
      removeUpload(file.filename);
      throw error;
    }
  });

  // ---------- Viagens (quilometragem) ----------
  app.get('/api/mileage-trips', requireAuth, async (req, res) => {
    const vehicleId = req.query.vehicleId ? (await ownedVehicle(req, req.query.vehicleId)).id : undefined;
    res.json(await storage.getUserMileageTrips(userId(req), vehicleId));
  });

  app.post('/api/mileage-trips', requireAuth, async (req, res) => {
    const data = createMileageTripSchema.parse(req.body);
    await ownedVehicle(req, data.vehicleId);
    res.status(201).json(await storage.createMileageTrip(data));
  });

  app.put('/api/mileage-trips/:id', requireAuth, async (req, res) => {
    const trip = await storage.getUserMileageTrip(req.params.id, userId(req));
    if (!trip) throw new HttpError(404, 'Viagem não encontrada');
    const data = updateMileageTripSchema.parse(req.body);
    const updated = await storage.updateMileageTrip(trip.id, data);
    // Viagem concluída: atualiza a quilometragem do veículo se for maior
    if (data.endMileage) {
      const vehicle = await ownedVehicle(req, trip.vehicleId);
      if (data.endMileage > vehicle.currentMileage) {
        await storage.updateVehicle(vehicle.id, { currentMileage: data.endMileage });
      }
    }
    res.json(updated);
  });

  app.delete('/api/mileage-trips/:id', requireAuth, async (req, res) => {
    const trip = await storage.getUserMileageTrip(req.params.id, userId(req));
    if (!trip) throw new HttpError(404, 'Viagem não encontrada');
    await storage.deleteMileageTrip(trip.id);
    res.status(204).send();
  });

  // ---------- Documentos ----------
  app.post('/api/vehicles/:vehicleId/documents', requireAuth, requireVehicle, uploads.document.single('document'), async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, 'Nenhum ficheiro enviado');
    try {
      const { type, description, notes } = req.body ?? {};
      if (!type) throw new HttpError(400, 'O tipo de documento é obrigatório');
      const data = createDocumentSchema.parse({
        vehicleId: req.vehicle!.id,
        type,
        description: description || file.originalname.slice(0, 200),
        fileUrl: `/uploads/${file.filename}`,
        uploadDate: new Date(),
        notes: notes || null,
      });
      res.status(201).json(await storage.createDocument(data));
    } catch (error) {
      removeUpload(file.filename);
      throw error;
    }
  });

  app.get('/api/vehicles/:vehicleId/documents', requireAuth, requireVehicle, async (req, res) => {
    res.json(await storage.getVehicleDocuments(req.vehicle!.id));
  });

  app.delete('/api/documents/:documentId', requireAuth, async (req, res) => {
    const document = await storage.getUserDocument(req.params.documentId, userId(req));
    if (!document) throw new HttpError(404, 'Documento não encontrado');
    removeUpload(document.fileUrl);
    await storage.deleteDocument(document.id);
    res.status(204).send();
  });
}
