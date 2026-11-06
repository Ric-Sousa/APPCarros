// Teste de integração: API completa contra uma base de dados real.
// Por omissão usa SQLite em memória. Para testar outro motor, defina DB_CLIENT e DB_* antes de `npm test`
// (ATENÇÃO: usa as tabelas dessa base de dados; use uma base de dados de teste vazia).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import type { Server } from 'http';

process.env.JWT_SECRET = 'test-secret';
process.env.DB_CLIENT ??= 'sqlite';
if (process.env.DB_CLIENT === 'sqlite') process.env.DB_FILE ??= ':memory:';

const { default: express } = await import('express');
const { registerRoutes } = await import('./routes');
const { errorHandler, UPLOAD_DIR } = await import('./http');
const { db, setupDatabase, closeDatabase, toRow, withDefaults } = await import('./db');
const schema = await import('@shared/schema');

let server: Server;
let base: string;
const tokens: Record<string, string> = {};

before(async () => {
  await setupDatabase(() => {});
  const app = express();
  app.use(express.json());
  registerRoutes(app);
  app.use(errorHandler);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => {
  server.close();
  await closeDatabase();
});

async function call(method: string, path: string, who?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (who) headers.Authorization = `Bearer ${tokens[who]}`;
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any;
  try { json = text ? JSON.parse(text) : undefined; } catch { json = text; }
  return { status: res.status, body: json };
}

// Os testes correm por ordem e partilham estado
const ids: Record<string, string> = {};
const suffix = Date.now().toString(36);
const email = (who: string) => `${who}.${suffix}@teste.pt`;

test('registo, login e utilizador', async () => {
  for (const who of ['alice', 'bob']) {
    const r = await call('POST', '/api/register', undefined, { name: `${who} Silva`, email: email(who), password: 'segredo123' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    tokens[who] = r.body.token;
  }
  assert.equal((await call('POST', '/api/register', undefined, { name: 'x', email: email('alice'), password: 'segredo123' })).status, 409);
  assert.equal((await call('POST', '/login', undefined, { email: email('alice'), password: 'errada' })).status, 401);
  assert.equal((await call('POST', '/login', undefined, { email: email('alice').toUpperCase(), password: 'segredo123' })).status, 200);

  const me = await call('GET', '/api/auth/user', 'alice');
  assert.equal(me.body.email, email('alice'));
  assert.equal('password' in me.body, false);
});

test('veículos: criação, matrícula por utilizador e acesso só do dono', async () => {
  const plate = `T-${suffix}`.slice(0, 10).toUpperCase();
  const vehicle = {
    licensePlate: plate, brand: 'BMW', model: 'Serie 3', year: 2020, currentMileage: 10000,
    fuelType: 'diesel', inspectionDue: '2030-01-15', lastOilChangeMileage: 5000, oilChangeInterval: 15000,
  };
  const a = await call('POST', '/api/vehicles', 'alice', vehicle);
  assert.equal(a.status, 201, JSON.stringify(a.body));
  ids.vehicle = a.body.id;
  assert.equal(a.body.userId, (await call('GET', '/api/auth/user', 'alice')).body.id);
  assert.ok(new Date(a.body.inspectionDue).getFullYear() === 2030);

  // Outro utilizador pode ter a mesma matrícula; o mesmo utilizador não
  assert.equal((await call('POST', '/api/vehicles', 'bob', vehicle)).status, 201);
  assert.equal((await call('POST', '/api/vehicles', 'alice', vehicle)).status, 409);

  assert.equal((await call('GET', `/api/vehicles/${ids.vehicle}`, 'bob')).status, 404);
  assert.equal((await call('DELETE', `/api/vehicles/${ids.vehicle}`, 'bob')).status, 404);
  assert.equal((await call('GET', '/api/vehicles', 'alice')).body.length, 1);
});

test('PATCH parcial: ignora userId e não apaga datas', async () => {
  const r = await call('PATCH', `/api/vehicles/${ids.vehicle}`, 'alice', { userId: 'bob', currentMileage: 12000 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.currentMileage, 12000);
  assert.ok(r.body.inspectionDue, 'a data de inspeção mantém-se');
  assert.equal((await call('GET', `/api/vehicles/${ids.vehicle}`, 'alice')).status, 200);
});

test('combustível: criar, editar, apagar e consumo', async () => {
  for (const [date, mileage, liters] of [['2026-01-01', 12000, '40'], ['2026-01-20', 12500, '30'], ['2026-02-10', 13000, '30']] as const) {
    const r = await call('POST', '/api/fuel-records', 'alice', {
      vehicleId: ids.vehicle, date, mileage, liters, costPerLiter: '1.65', totalCost: (Number(liters) * 1.65).toFixed(2), fuelType: 'diesel',
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.fullTank, false);
    ids.fuel = r.body.id;
  }
  assert.equal((await call('POST', '/api/fuel-records', 'bob', { vehicleId: ids.vehicle, date: '2026-01-01', mileage: 1, liters: 1, costPerLiter: 1, totalCost: 1, fuelType: 'x' })).status, 404);

  const put = await call('PUT', `/api/fuel-records/${ids.fuel}`, 'alice', { notes: 'cheio', fullTank: true });
  assert.equal(put.status, 200);
  assert.equal(put.body.fullTank, true);
  assert.equal(Number(put.body.liters), 30);
  assert.equal((await call('PUT', `/api/fuel-records/${ids.fuel}`, 'bob', { notes: 'x' })).status, 404);

  const list = await call('GET', `/api/fuel-records?vehicleId=${ids.vehicle}`, 'alice');
  assert.equal(list.body.length, 3);
  assert.ok(new Date(list.body[0].date) > new Date(list.body[2].date), 'ordenado por data descendente');

  // (30 + 30) L em 1000 km = 6 L/100km
  const compare = await call('GET', `/api/vehicles/${ids.vehicle}/compare`, 'alice');
  assert.equal(compare.body.userConsumption, 6);

  assert.equal((await call('DELETE', `/api/fuel-records/${ids.fuel}`, 'alice')).status, 204);
  assert.equal((await call('GET', '/api/fuel-records', 'alice')).body.length, 2);
});

test('viagens atualizam os km do veículo', async () => {
  const start = await call('POST', '/api/mileage-trips', 'alice', { vehicleId: ids.vehicle, startTime: new Date().toISOString(), startMileage: 12000, status: 'active' });
  assert.equal(start.status, 201, JSON.stringify(start.body));
  assert.equal((await call('PUT', `/api/mileage-trips/${start.body.id}`, 'bob', { status: 'completed' })).status, 404);
  const end = await call('PUT', `/api/mileage-trips/${start.body.id}`, 'alice', {
    endTime: new Date().toISOString(), endMileage: 12150, duration: 600, totalDistance: 150, status: 'completed',
  });
  assert.equal(end.status, 200);
  assert.equal((await call('GET', `/api/vehicles/${ids.vehicle}`, 'alice')).body.currentMileage, 12150);
  assert.equal((await call('GET', '/api/stats', 'alice')).body.monthlyKms, 150);
});

test('despesas, marcações e reservas', async () => {
  const expense = await call('POST', '/api/expenses', 'alice', { vehicleId: ids.vehicle, type: 'maintenance', category: 'oficina', amount: '120.50', date: '2026-03-01' });
  assert.equal(expense.status, 201, JSON.stringify(expense.body));
  assert.equal((await call('GET', `/api/expenses?vehicleId=${ids.vehicle}`, 'alice')).body.length, 1);
  assert.equal((await call('GET', `/api/expenses?vehicleId=${ids.vehicle}`, 'bob')).status, 404);

  const appt = await call('POST', `/api/vehicles/${ids.vehicle}/appointments`, 'alice', { type: 'oil_change', title: 'Óleo', scheduledDate: '2026-04-01', scheduledTime: '10:00' });
  assert.equal(appt.status, 201, JSON.stringify(appt.body));
  assert.equal(appt.body.estimatedDuration, 60);
  assert.equal((await call('PUT', `/api/appointments/${appt.body.id}`, 'bob', { status: 'done' })).status, 404);
  assert.equal((await call('PUT', `/api/appointments/${appt.body.id}`, 'alice', { status: 'completed' })).body.status, 'completed');
  assert.equal((await call('DELETE', `/api/appointments/${appt.body.id}`, 'alice')).status, 204);

  const res = await call('POST', `/api/vehicles/${ids.vehicle}/reservations`, 'alice', {
    stationId: '1', stationName: 'Posto', stationAddress: 'Rua A', reservationDate: '2026-04-02', startTime: '09:00', endTime: '10:00', estimatedChargingTime: 60, chargingType: 'fast',
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
});

test('alertas: só o dono os altera', async () => {
  const id = `alert-${suffix}`;
  await db.insertInto('alerts').values(toRow(schema.alerts, withDefaults(schema.alerts, { id, vehicleId: ids.vehicle, type: 'oil', title: 'Óleo', priority: 'urgent' }))).execute();
  const stats = await call('GET', '/api/stats', 'alice');
  assert.equal(stats.body.urgentAlerts, 1);
  assert.equal((await call('PATCH', `/api/alerts/${id}/dismiss`, 'bob')).status, 404);
  assert.equal((await call('PATCH', `/api/alerts/${id}/dismiss`, 'alice')).status, 204);
  assert.equal((await call('GET', '/api/alerts', 'alice')).body.length, 0);
});

test('preferências e planos de rota (JSON)', async () => {
  const prefs = { theme: 'dark', notificationPreferences: { fuel: false } };
  assert.equal((await call('POST', '/api/user/preferences', 'alice', prefs)).status, 200);
  assert.equal((await call('POST', '/api/user/preferences', 'alice', { ...prefs, theme: 'light' })).status, 200);
  assert.deepEqual((await call('GET', '/api/user/preferences', 'alice')).body, { ...prefs, theme: 'light' });

  const plan = await call('POST', '/api/route-plans', 'alice', { vehicleId: ids.vehicle, name: 'Casa', originLat: 38.7, originLon: -9.1, destinationLat: 41.1, destinationLon: -8.6 });
  assert.equal(plan.status, 200, JSON.stringify(plan.body));
  assert.equal((await call('PUT', `/api/route-plans/${plan.body.id}`, 'alice', { name: 'Trabalho', userId: 'bob' })).status, 200);
  const plans = (await call('GET', '/api/route-plans', 'alice')).body.plans;
  assert.equal(plans[0].name, 'Trabalho');
  assert.equal(plans[0].originLat, 38.7);
  assert.equal((await call('GET', '/api/route-plans', 'bob')).body.plans.length, 0);
});

test('documentos: upload, acesso só do dono e remoção', async () => {
  const form = new FormData();
  form.append('type', 'insurance');
  form.append('document', new Blob(['%PDF-1.4 teste'], { type: 'application/pdf' }), 'seguro.pdf');
  const up = await call('POST', `/api/vehicles/${ids.vehicle}/documents`, 'alice', form);
  assert.equal(up.status, 201, JSON.stringify(up.body));
  assert.match(up.body.fileUrl, /^\/uploads\/.+\.pdf$/);

  const bad = new FormData();
  bad.append('type', 'x');
  bad.append('document', new Blob(['<script>'], { type: 'text/html' }), 'x.html');
  assert.equal((await call('POST', `/api/vehicles/${ids.vehicle}/documents`, 'alice', bad)).status, 400);

  assert.equal((await call('GET', up.body.fileUrl, 'alice')).status, 200);
  assert.equal((await call('GET', up.body.fileUrl, 'bob')).status, 404);
  assert.equal((await call('GET', up.body.fileUrl)).status, 401);

  assert.equal((await call('DELETE', `/api/documents/${up.body.id}`, 'bob')).status, 404);
  assert.equal((await call('DELETE', `/api/documents/${up.body.id}`, 'alice')).status, 204);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(fs.existsSync(`${UPLOAD_DIR}/${up.body.fileUrl.split('/').pop()}`), false);
});

test('apagar o veículo apaga os dados associados', async () => {
  assert.equal((await call('DELETE', `/api/vehicles/${ids.vehicle}`, 'alice')).status, 204);
  assert.equal((await call('GET', '/api/fuel-records', 'alice')).body.length, 0);
  const leftovers = await db.selectFrom('fuel_records').select('id').where('vehicle_id', '=', ids.vehicle).execute();
  assert.equal(leftovers.length, 0);
});

test('validação devolve detalhes', async () => {
  const r = await call('POST', '/api/register', undefined, { name: 'A', email: 'mau', password: '1' });
  assert.equal(r.status, 400);
  assert.ok(r.body.errors.length >= 2);
  assert.equal((await call('GET', '/api/vehicle-data/12-AB-34')).status, 401);
});
