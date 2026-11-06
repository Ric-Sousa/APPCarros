import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consumptionL100, monthlyExpenses, predictiveRisk, vehicleRecommendations } from './stats';
import { extractDate, extractTotal } from './services/ocrService';
import { vehicleKind, imageScore, cleanAuthor } from './services/vehicleImage';
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

test('tipo de veículo para a pesquisa de imagem', () => {
  assert.equal(vehicleKind({ vehicleCategory: 'Mota', iucCategory: 'IUC' }), 'motorcycle');
  assert.equal(vehicleKind({ vehicleCategory: 'Motociclo', iucCategory: null }), 'motorcycle');
  assert.equal(vehicleKind({ vehicleCategory: '', iucCategory: 'Categoria E' }), 'motorcycle');
  assert.equal(vehicleKind({ vehicleCategory: 'Ciclomotor' }), 'motorcycle');
  assert.equal(vehicleKind({ vehicleCategory: 'Pesado de mercadorias' }), 'truck');
  assert.equal(vehicleKind({ vehicleCategory: 'Ligeiro de mercadorias' }), 'van');
  assert.equal(vehicleKind({ vehicleCategory: 'Ligeiro de passageiros', iucCategory: 'Categoria B' }), 'car');
  assert.equal(vehicleKind({ vehicleCategory: 'Automóvel' }), 'car');
});

test('pontuação de fotos: ano, modelo sem hífen e cilindrada', () => {
  const suzuki = { brand: 'Suzuki', model: 'GSXR', year: 2007, engineDisplacement: 599 };
  const s2007 = imageScore('File:2007TMS Suzuki GSX-R 600.jpg', suzuki);
  const s750 = imageScore('File:Suzuki GSX-R 750 2007-1.jpg', suzuki);
  const s1992 = imageScore('File:1992 Suzuki GSXR-600W.jpg', suzuki);
  assert.ok(s2007 > s750, 'a 600 de 2007 ganha à 750 de 2007');
  assert.ok(s750 > s1992, 'o ano certo ganha a um modelo antigo');
  assert.equal(imageScore('File:Suzuki Bandit 2007.jpg', suzuki), 0, 'sem o modelo no título não serve');
  // Modelos curtos não podem coincidir com nomes de ficheiro de câmara
  assert.equal(imageScore('File:DSC3456 Citroen 2019.jpg', { brand: 'Citroën', model: 'C3', year: 2019 }), 0);
  assert.ok(imageScore('File:Citroën C3 (2019).jpg', { brand: 'Citroën', model: 'C3', year: 2019 }) >= 7);
  assert.ok(imageScore('File:Yamaha MT-07 2021.jpg', { brand: 'Yamaha', model: 'MT07', year: 2021 }) >= 7);
});

test('créditos do Commons legíveis', () => {
  assert.equal(cleanAuthor('No machine-readable author provided. Golden~commonswiki assumed (based on copyright claims).'), 'Golden');
  assert.equal(cleanAuthor('<a href="x">Pawlex</a> (<a href="y">talk</a>)'), 'Pawlex');
  assert.equal(cleanAuthor(''), 'Autor desconhecido');
});

test('PATCH de veículo não aceita userId nem id', () => {
  const parsed = updateVehicleSchema.parse({ userId: 'outro', id: 'x', brand: 'BMW' });
  assert.deepEqual(parsed, { brand: 'BMW' });
});
