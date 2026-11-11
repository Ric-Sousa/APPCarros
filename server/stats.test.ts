import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consumptionL100, monthlyExpenses, predictiveRisk, vehicleRecommendations } from './stats';
import { extractDate, extractTotal, extractValidityDate } from './services/ocrService';
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

test('prazos legais calculados a partir da matrícula', async () => {
  const { suggestIucDue, suggestInspectionDue, nextDeadlineAfter } = await import('@shared/deadlines');
  const now = new Date('2026-11-11T10:00:00Z');
  const iso = (d?: Date) => d?.toISOString().slice(0, 10);
  // IUC: fim do mês da matrícula, na próxima ocorrência
  assert.equal(iso(suggestIucDue('2015-03-10', now)), '2027-03-31');
  assert.equal(iso(suggestIucDue('2020-11-02', now)), '2026-11-30');
  // Ligeiro: 4 anos, depois de 2 em 2 até aos 8, depois anual
  assert.equal(iso(suggestInspectionDue('2024-06-15', 'car', now)), '2028-06-15');
  assert.equal(iso(suggestInspectionDue('2021-12-01', 'car', now)), '2027-12-01'); // aos 4 (2025) já passou -> aos 6
  assert.equal(iso(suggestInspectionDue('2010-01-20', 'car', now)), '2027-01-20'); // anual
  assert.equal(iso(suggestInspectionDue('2025-02-01', 'van', now)), '2027-02-01');
  assert.equal(suggestInspectionDue('2020-01-01', 'motorcycle', now), undefined);
  assert.equal(iso(nextDeadlineAfter('iuc', new Date('2026-03-31T00:00:00Z'))), '2027-03-31');
});

test('autenticação em dois passos: códigos TOTP (vetor do RFC 6238)', async () => {
  const { totpCode, verifyTotp, base32Encode } = await import('./totp');
  // Segredo do RFC 6238 ("12345678901234567890"); o RFC dá 8 dígitos (94287082), aqui usam-se os últimos 6
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  assert.equal(totpCode(secret, 59_000), '287082');
  assert.equal(verifyTotp(secret, '287082', 59_000), true);
  assert.equal(verifyTotp(secret, '287082', 59_000 + 90_000), false);
  assert.equal(verifyTotp(secret, 'abc', 59_000), false);
});

test('planos: plano pago expirado volta a Grátis', async () => {
  const { effectivePlan } = await import('@shared/plans');
  const now = new Date('2026-11-11T00:00:00Z');
  assert.equal(effectivePlan('premium', '2026-12-01', now).id, 'premium');
  assert.equal(effectivePlan('premium', '2026-10-01', now).id, 'free');
  assert.equal(effectivePlan(null, null, now).id, 'free');
  assert.equal(effectivePlan('inventado', null, now).id, 'free');
});

test('validade lida de documentos (OCR)', () => {
  const now = new Date('2026-11-11T00:00:00Z');
  const apolice = 'Apólice 123\nData de emissão: 01/12/2025\nVálido até 30/11/2027\nPrémio anual';
  assert.equal(extractValidityDate(apolice, now)?.toISOString().slice(0, 10), '2027-11-30');
  // Sem palavra-chave: a data futura mais distante
  assert.equal(extractValidityDate('Inspeção 12/03/2026 próxima 12-03-2027', now)?.toISOString().slice(0, 10), '2027-03-12');
  assert.equal(extractValidityDate('Emitido em 01/01/2020', now), undefined);
});

test('emails: o HTML escapa o conteúdo', async () => {
  const { renderMail } = await import('./services/mailer');
  const { html, text } = renderMail({ to: 'a@b.pt', subject: 'x', paragraphs: ['<script>alert(1)</script>'], action: { label: 'Abrir', url: 'https://x.pt/?a=1&b=2' } });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(text.includes('https://x.pt/?a=1&b=2'));
});
