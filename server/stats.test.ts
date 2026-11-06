import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consumptionL100, monthlyExpenses, predictiveRisk, vehicleRecommendations } from './stats';
import { extractDate, extractTotal } from './services/ocrService';
import { updateVehicleSchema } from '@shared/schema';
import type { Vehicle } from '@shared/schema';

test('consumo: ignora o primeiro abastecimento e precisa de 2 registos', () => {
  assert.equal(consumptionL100([{ liters: '40', mileage: 1000 }]), null);
  // 1000 km percorridos com 30 + 30 litros = 6 L/100km
  assert.equal(consumptionL100([
    { liters: '50', mileage: 1000 },
    { liters: '30', mileage: 1500 },
    { liters: '30', mileage: 2000 },
  ]), 6);
});

test('despesas mensais: só os últimos 12 meses', () => {
  const now = new Date('2026-06-01');
  assert.equal(monthlyExpenses([
    { amount: '120', date: '2026-05-01' },
    { amount: '1200', date: '2024-01-01' },
  ], now), 10);
});

test('risco preditivo', () => {
  const now = new Date('2026-01-01');
  const risk = predictiveRisk({
    currentMileage: 25000, lastOilChangeMileage: 10000, oilChangeInterval: 15000,
    lastTireChangeMileage: null, tireChangeInterval: null, inspectionDue: new Date('2025-12-01'),
  }, now);
  assert.deepEqual(risk, { oilRisk: 1, tireRisk: 0, inspectionRisk: 1 });
});

test('recomendações: óleo em atraso e IUC a expirar', () => {
  const now = new Date('2026-01-01');
  const vehicle = {
    currentMileage: 31000, lastOilChangeMileage: 15000, oilChangeInterval: 15000,
    lastTireChangeMileage: null, tireChangeInterval: null,
    inspectionDue: null, iucDue: new Date('2026-01-10'), insuranceDue: null,
  } as unknown as Vehicle;
  const recs = vehicleRecommendations(vehicle, now);
  assert.equal(recs[0].priority, 'urgent');
  assert.match(recs[0].title, /óleo em atraso/);
  assert.ok(recs.some((r) => r.title === 'IUC em 9 dias'));
});

test('OCR: datas portuguesas e totais com milhares', () => {
  assert.equal(extractDate('Data: 01/02/2024')?.toISOString().slice(0, 10), '2024-02-01');
  assert.equal(extractDate('2024-12-25 10:00')?.toISOString().slice(0, 10), '2024-12-25');
  assert.equal(extractDate('31/02/2024'), undefined);
  assert.equal(extractTotal('IVA 23% 2,30\nTOTAL 1.234,56 EUR'), 1234.56);
  assert.equal(extractTotal('Gasóleo 45,90'), 45.9);
});

test('PATCH de veículo não aceita userId nem id', () => {
  const parsed = updateVehicleSchema.parse({ userId: 'outro', id: 'x', brand: 'BMW' });
  assert.deepEqual(parsed, { brand: 'BMW' });
});
