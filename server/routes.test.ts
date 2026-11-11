// Teste de integração: API completa contra uma base de dados real.
// Por omissão usa SQLite em memória. Para testar outro motor, defina DB_CLIENT e DB_* antes de `npm test`
// (ATENÇÃO: usa as tabelas dessa base de dados; use uma base de dados de teste vazia).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Server } from 'http';

process.env.JWT_SECRET = 'test-secret-com-pelo-menos-32-caracteres';
// Emails de teste numa pasta temporária (modo de desenvolvimento, sem SMTP)
const MAIL_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'logicar-mail-'));
process.env.DEV_MAIL_DIR = MAIL_DIR;
delete process.env.SMTP_URL;
delete process.env.STRIPE_SECRET_KEY;
process.env.TZ = 'UTC';
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
// Cookie de sessão (refresh token) de cada utilizador
const cookies: Record<string, string> = {};

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
  fs.rmSync(MAIL_DIR, { recursive: true, force: true });
});

/** Último email enviado para o endereço (modo de desenvolvimento) e o token do primeiro link com ?token=. */
function lastMail(to: string) {
  const files = fs.readdirSync(MAIL_DIR).filter((f) => f.includes(to.replace(/[^a-z0-9@.]/gi, '_'))).sort();
  const html = files.length ? fs.readFileSync(path.join(MAIL_DIR, files[files.length - 1]), 'utf8') : '';
  const token = /[?&]token=([^"&<\s]+)/.exec(html)?.[1];
  return { html, token: token ? decodeURIComponent(token) : undefined, count: files.length };
}

async function call(method: string, path: string, who?: string, body?: unknown, cookieOf?: string) {
  const headers: Record<string, string> = {};
  if (who) headers.Authorization = `Bearer ${tokens[who]}`;
  if (cookieOf && cookies[cookieOf]) headers.Cookie = cookies[cookieOf];
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  // Guarda o cookie de sessão devolvido (login, registo, renovação)
  const setCookie = res.headers.get('set-cookie');
  const rt = setCookie && /logicar_rt=([^;]*)/.exec(setCookie);
  if (rt && cookieOf !== undefined) cookies[cookieOf] = rt[1] ? `logicar_rt=${rt[1]}` : '';
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
    const r = await call('POST', '/api/register', undefined, { name: `${who} Silva`, email: email(who), password: 'segredo123', acceptTerms: true }, who);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    tokens[who] = r.body.token;
  }
  // Sem aceitar os termos não há registo
  assert.equal((await call('POST', '/api/register', undefined, { name: 'x', email: email('zz'), password: 'segredo123' })).status, 400);
  assert.equal((await call('POST', '/api/register', undefined, { name: 'x', email: email('alice'), password: 'segredo123', acceptTerms: true })).status, 409);
  // A Alice usa o plano Premium (ativação de desenvolvimento); o Bob fica no Grátis
  assert.equal((await call('POST', '/api/billing/dev-activate', 'alice', { plan: 'premium' })).status, 204);
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
  assert.equal((await call('POST', '/api/fuel-records', 'bob', { vehicleId: ids.vehicle, date: '2026-01-01', mileage: 1, liters: 1, costPerLiter: 1, totalCost: 1, fuelType: 'diesel' })).status, 404);

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

test('alertas gerados a partir dos dados do veículo; só o dono os altera', async () => {
  // IUC a vencer ontem -> alerta urgente
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  assert.equal((await call('PATCH', `/api/vehicles/${ids.vehicle}`, 'alice', { iucDue: yesterday })).status, 200);
  const stats = await call('GET', '/api/stats', 'alice');
  assert.equal(stats.body.urgentAlerts, 1);
  const alerts = (await call('GET', '/api/alerts', 'alice')).body;
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].type, 'iuc');
  assert.equal((await call('GET', '/api/alerts', 'bob')).body.length, 0);
  assert.equal((await call('PATCH', `/api/alerts/${alerts[0].id}/dismiss`, 'bob')).status, 404);
  assert.equal((await call('PATCH', `/api/alerts/${alerts[0].id}/dismiss`, 'alice')).status, 204);
  // descartado continua descartado depois de nova sincronização
  assert.equal((await call('GET', '/api/alerts', 'alice')).body.length, 0);
  assert.equal((await call('GET', '/api/stats', 'alice')).body.urgentAlerts, 0);
  // novo prazo (IUC pago e renovado) -> sem alerta
  assert.equal((await call('PATCH', `/api/vehicles/${ids.vehicle}`, 'alice', { iucDue: '2030-01-01' })).status, 200);
  assert.equal((await call('GET', '/api/alerts', 'alice')).body.length, 0);
});

test('preferências e planos de rota (JSON)', async () => {
  const prefs = { theme: 'dark', notificationPreferences: { fuel: false } };
  assert.equal((await call('POST', '/api/user/preferences', 'alice', prefs)).status, 200);
  assert.equal((await call('POST', '/api/user/preferences', 'alice', { ...prefs, theme: 'light' })).status, 200);
  const saved = (await call('GET', '/api/user/preferences', 'alice')).body;
  assert.equal(saved.theme, 'light');
  assert.equal(saved.notificationPreferences.fuel, false);
  // valores por omissão completados (lembretes por email, 30/7/1 dias)
  assert.equal(saved.notificationPreferences.email, true);
  assert.deepEqual(saved.notificationPreferences.leadDays, [30, 7, 1]);
  assert.equal((await call('POST', '/api/user/preferences', 'alice', { notificationPreferences: { leadDays: [15] } })).status, 400);

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
  if (ids.vehicle2) assert.equal((await call('DELETE', `/api/vehicles/${ids.vehicle2}`, 'alice')).status, 204);
  assert.equal((await call('DELETE', `/api/vehicles/${ids.vehicle}`, 'alice')).status, 204);
  assert.equal((await call('GET', '/api/fuel-records', 'alice')).body.length, 0);
  const leftovers = await db.selectFrom('fuel_records').select('id').where('vehicle_id', '=', ids.vehicle).execute();
  assert.equal(leftovers.length, 0);
});

test('segurança: receiptUrl e imageUrl não podem apontar para ficheiros de outros', async () => {
  const other = await call('POST', '/api/vehicles', 'alice', { licensePlate: `S-${suffix}`.slice(0, 10), brand: 'Seat', model: 'Ibiza', year: 2015, currentMileage: 1 });
  assert.equal(other.status, 201);
  ids.vehicle2 = other.body.id;
  // receiptUrl enviado pelo cliente é ignorado
  const exp = await call('POST', '/api/expenses', 'alice', { vehicleId: ids.vehicle2, type: 'x', category: 'y', amount: 1, date: '2026-01-01', receiptUrl: '/uploads/de-outro.pdf' });
  assert.equal(exp.status, 201);
  assert.equal(exp.body.receiptUrl, null);
  // imageUrl com caminho manipulado é rejeitado
  for (const imageUrl of ['/uploads/vehicle-x/../de-outro.pdf', 'javascript:alert(1)', 'http://inseguro/foto.jpg', '/uploads/documento.pdf']) {
    assert.equal((await call('PATCH', `/api/vehicles/${ids.vehicle2}`, 'alice', { imageUrl })).status, 400, imageUrl);
  }
  assert.equal((await call('PATCH', `/api/vehicles/${ids.vehicle2}`, 'alice', { imageUrl: 'https://upload.wikimedia.org/x.jpg' })).status, 200);
});

test('validação de números e datas', async () => {
  const bad = [
    { liters: 'abc' }, { costPerLiter: -5 }, { date: 'banana' }, { mileage: 1.5 },
  ];
  for (const patch of bad) {
    const r = await call('POST', '/api/fuel-records', 'alice', { vehicleId: ids.vehicle2, date: '2026-01-01', mileage: 10, liters: '20', costPerLiter: '1.6', totalCost: '32', fuelType: 'diesel', ...patch });
    assert.equal(r.status, 400, JSON.stringify(patch));
  }
  // formatos portugueses e combustível antigo aceites
  const ok = await call('POST', '/api/fuel-records', 'alice', { vehicleId: ids.vehicle2, date: '15/01/2026', mileage: 10, liters: '20,5', costPerLiter: '1.6', totalCost: '32.8', fuelType: 'Gasóleo' });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.fuelType, 'diesel');
  assert.equal(new Date(ok.body.date).toISOString().slice(0, 10), '2026-01-15');
  assert.equal((await call('PATCH', `/api/vehicles/${ids.vehicle2}`, 'alice', { lastOilChange: 'banana' })).status, 400);
});

test('marcações, reservas e manutenções de todos os veículos', async () => {
  await call('POST', `/api/vehicles/${ids.vehicle2}/appointments`, 'alice', { type: 'inspection', title: 'Inspeção', scheduledDate: '2026-05-01', scheduledTime: '09:30' });
  await call('POST', `/api/vehicles/${ids.vehicle2}/maintenance`, 'alice', { type: 'oil_change', description: 'Óleo', performedAt: '2026-02-01', cost: '45.5' });
  assert.ok((await call('GET', '/api/appointments', 'alice')).body.length >= 1);
  assert.ok(Array.isArray((await call('GET', '/api/reservations', 'alice')).body));
  const recent = (await call('GET', '/api/maintenance?limit=5', 'alice')).body;
  assert.equal(recent[0].description, 'Óleo');
  assert.equal((await call('GET', '/api/appointments', 'bob')).body.length, 0);
});

test('comparação só com 5 ou mais veículos iguais', async () => {
  const c = (await call('GET', `/api/vehicles/${ids.vehicle2}/compare`, 'alice')).body;
  assert.equal(c.averageExpenses, undefined);
  assert.equal(c.averageConsumption, undefined);
});

test('ficheiros: 404 para inexistentes e health check', async () => {
  assert.equal((await call('GET', '/uploads/profile-nao-existe.png')).status, 404);
  const health = await call('GET', '/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');
});

test('palavra-passe e eliminação de conta', async () => {
  const r = await call('POST', '/api/register', undefined, { name: 'Carla', email: email('carla'), password: 'segredo123', acceptTerms: true });
  tokens.carla = r.body.token;
  assert.equal((await call('PUT', '/api/user/password', 'carla', { currentPassword: 'errada', newPassword: 'nova-pass-1' })).status, 401);
  assert.equal((await call('PUT', '/api/user/password', 'carla', { currentPassword: 'segredo123', newPassword: 'nova-pass-1' })).status, 204);
  assert.equal((await call('POST', '/login', undefined, { email: email('carla'), password: 'nova-pass-1' })).status, 200);
  const car = await call('POST', '/api/vehicles', 'carla', { licensePlate: 'CA-01-RL', brand: 'Fiat', model: '500', year: 2018, currentMileage: 5 });
  assert.equal((await call('DELETE', '/api/user', 'carla', { password: 'errada' })).status, 401);
  assert.equal((await call('DELETE', '/api/user', 'carla', { password: 'nova-pass-1' })).status, 204);
  assert.equal((await call('POST', '/login', undefined, { email: email('carla'), password: 'nova-pass-1' })).status, 401);
  const left = await db.selectFrom('vehicles').select('id').where('id', '=', car.body.id).execute();
  assert.equal(left.length, 0);
});

test('validação devolve detalhes', async () => {
  const r = await call('POST', '/api/register', undefined, { name: 'A', email: 'mau', password: '1' });
  assert.equal(r.status, 400);
  assert.ok(r.body.errors.length >= 2);
  assert.equal((await call('GET', '/api/vehicle-data/12-AB-34')).status, 401);
});

test('consulta de matrícula: campos do PHP traduzidos para o formulário', async () => {
  const { mapVehicleData } = await import('./services/vehicleApi');
  const mapped = mapVehicleData('AA-00-AA', {
    brand: 'SUZUKI', model: 'GSX-R 600', year: '2007', fuelType: 'Gasolina', cylinderCapacity: '599 cm3',
    powerCV: '125 cv', entity: 'IMT', category: 'Motociclo', inspectionValidity: '31/12/2026',
    insuranceEnd: 'Não encontrado', iucCategory: 'E',
  });
  assert.deepEqual(mapped, {
    licensePlate: 'AA-00-AA', brand: 'SUZUKI', model: 'GSX-R 600', year: 2007, fuelType: 'gasoline95',
    powerCV: 125, engineDisplacement: 599, iucCategory: 'E', certifyingEntity: 'IMT', vehicleCategory: 'Motociclo',
    inspectionDue: '2026-12-31',
  });
});

// ======================= Funcionalidades comerciais =======================

test('sessão: renovar, deteção de reutilização e logout', async () => {
  const r = await call('POST', '/api/register', undefined, { name: 'Dani Costa', email: email('dani'), password: 'segredo123', acceptTerms: true }, 'dani');
  assert.equal(r.status, 201);
  tokens.dani = r.body.token;
  const first = cookies.dani;
  assert.ok(first, 'o registo devolve o cookie de sessão');

  const renewed = await call('POST', '/api/auth/refresh', undefined, undefined, 'dani');
  assert.equal(renewed.status, 200);
  assert.ok(renewed.body.token);
  const second = cookies.dani;
  assert.notEqual(second, first, 'o refresh token roda a cada renovação');

  // Reutilizar o token antigo (roubo) termina toda a família de sessões
  cookies.stolen = first;
  assert.equal((await call('POST', '/api/auth/refresh', undefined, undefined, 'stolen')).status, 401);
  assert.equal((await call('POST', '/api/auth/refresh', undefined, undefined, 'dani')).status, 401);

  // Novo login e logout
  const login = await call('POST', '/login', undefined, { email: email('dani'), password: 'segredo123', remember: true }, 'dani');
  assert.equal(login.status, 200);
  tokens.dani = login.body.token;
  const sessions = (await call('GET', '/api/user/sessions', 'dani')).body;
  assert.ok(sessions.some((s: any) => s.current));
  const beforeLogout = cookies.dani;
  assert.equal((await call('POST', '/api/auth/logout', undefined, undefined, 'dani')).status, 204);
  cookies.dani = beforeLogout;
  assert.equal((await call('POST', '/api/auth/refresh', undefined, undefined, 'dani')).status, 401);
});

test('email: verificação e recuperação da palavra-passe', async () => {
  const verifyMail = lastMail(email('dani'));
  assert.ok(verifyMail.token, 'o registo envia o email de confirmação');
  assert.equal((await call('POST', '/api/auth/verify-email', undefined, { token: verifyMail.token })).status, 204);
  assert.equal((await call('POST', '/api/auth/verify-email', undefined, { token: verifyMail.token })).status, 400, 'uso único');
  assert.ok((await call('GET', '/api/auth/user', 'dani')).body.emailVerifiedAt);

  // Recuperação: resposta igual para emails que não existem
  assert.equal((await call('POST', '/api/auth/forgot-password', undefined, { email: 'ninguem@teste.pt' })).status, 204);
  assert.equal((await call('POST', '/api/auth/forgot-password', undefined, { email: email('dani') })).status, 204);
  const reset = lastMail(email('dani'));
  assert.match(reset.html, /Recuperar a palavra-passe/);
  assert.equal((await call('POST', '/api/auth/reset-password', undefined, { token: reset.token, password: 'curta' })).status, 400);
  assert.equal((await call('POST', '/api/auth/reset-password', undefined, { token: reset.token, password: 'nova-palavra-1' })).status, 204);
  assert.equal((await call('POST', '/login', undefined, { email: email('dani'), password: 'segredo123' })).status, 401);
  const login = await call('POST', '/login', undefined, { email: email('dani'), password: 'nova-palavra-1' }, 'dani');
  assert.equal(login.status, 200);
  tokens.dani = login.body.token;
});

test('autenticação em dois passos (TOTP)', async () => {
  const { totpCode } = await import('./totp');
  const setup = await call('POST', '/api/user/2fa/setup', 'dani');
  assert.equal(setup.status, 200);
  assert.match(setup.body.qrSvg, /<svg/);
  assert.equal((await call('POST', '/api/user/2fa/enable', 'dani', { code: '000000' })).status, 400);
  assert.equal((await call('POST', '/api/user/2fa/enable', 'dani', { code: totpCode(setup.body.secret) })).status, 204);
  const me = (await call('GET', '/api/auth/user', 'dani')).body;
  assert.equal(me.totpEnabled, true);
  assert.equal('totpSecret' in me, false);

  const step1 = await call('POST', '/login', undefined, { email: email('dani'), password: 'nova-palavra-1' });
  assert.equal(step1.body.twoFactorRequired, true);
  assert.equal(step1.body.token, undefined, 'sem o código não há sessão');
  assert.equal((await call('POST', '/api/auth/2fa', undefined, { challengeToken: step1.body.challengeToken, code: '123456' })).status, 401);
  const step2 = await call('POST', '/api/auth/2fa', undefined, { challengeToken: step1.body.challengeToken, code: totpCode(setup.body.secret) });
  assert.equal(step2.status, 200);
  assert.ok(step2.body.token);
  // O desafio não serve como token de acesso
  tokens.challenge = step1.body.challengeToken;
  assert.equal((await call('GET', '/api/auth/user', 'challenge')).status, 401);
});

test('planos: limite de veículos e funcionalidades pagas', async () => {
  // O Bob (Grátis) já tem 1 veículo
  const second = await call('POST', '/api/vehicles', 'bob', { licensePlate: 'BO-22-BB', brand: 'Opel', model: 'Corsa', year: 2016, currentMileage: 1 });
  assert.equal(second.status, 402);
  assert.equal(second.body.code, 'PLAN_LIMIT');
  assert.equal(second.body.feature, 'vehicles');
  const bobVehicle = (await call('GET', '/api/vehicles', 'bob')).body[0];
  assert.equal((await call('GET', `/api/vehicles/${bobVehicle.id}/report`, 'bob')).body.feature, 'pdfReport');
  assert.equal((await call('POST', '/api/push/subscribe', 'bob', { endpoint: 'https://push.example/x', keys: { p256dh: 'p'.repeat(20), auth: 'a'.repeat(10) } })).status, 402);
  const billing = (await call('GET', '/api/billing', 'bob')).body;
  assert.equal(billing.plan, 'free');
  assert.equal(billing.provider, 'dev');
});

test('prazos sugeridos, adiar e concluir alertas', async () => {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const v = await call('POST', '/api/vehicles', 'alice', {
    licensePlate: `R-${suffix}`.slice(0, 10), brand: 'Renault', model: 'Clio', year: 2015, currentMileage: 90000, registrationDate: '2015-03-10',
  });
  assert.equal(v.status, 201, JSON.stringify(v.body));
  ids.vehicle3 = v.body.id;
  // IUC no fim de março; inspeção anual (carro com mais de 8 anos) a 10 de março
  assert.equal(new Date(v.body.iucDue).getUTCMonth(), 2);
  assert.equal(new Date(v.body.iucDue).getUTCDate(), 31);
  assert.equal(new Date(v.body.inspectionDue).toISOString().slice(5, 10), '03-10');

  await call('PATCH', `/api/vehicles/${ids.vehicle3}`, 'alice', { iucDue: yesterday });
  const alert = (await call('GET', '/api/alerts', 'alice')).body.find((a: any) => a.vehicleId === ids.vehicle3 && a.type === 'iuc');
  assert.ok(alert);
  assert.equal((await call('POST', `/api/alerts/${alert.id}/snooze`, 'bob', { days: 3 })).status, 404);
  assert.equal((await call('POST', `/api/alerts/${alert.id}/snooze`, 'alice', { days: 3 })).status, 204);
  assert.equal((await call('GET', '/api/alerts', 'alice')).body.some((a: any) => a.id === alert.id), false, 'adiado fica escondido');

  const done = await call('POST', `/api/alerts/${alert.id}/done`, 'alice');
  assert.equal(done.status, 200);
  assert.equal(new Date(done.body.vehicle.iucDue).getUTCFullYear(), new Date(yesterday).getUTCFullYear() + 1, 'IUC passa para o ano seguinte');
});

test('partilha do veículo com outra pessoa', async () => {
  assert.equal((await call('POST', `/api/vehicles/${ids.vehicle3}/members`, 'alice', { email: email('bob') })).status, 201);
  const invite = lastMail(email('bob'));
  assert.ok(invite.token);
  assert.equal((await call('GET', `/api/invites/${encodeURIComponent(invite.token!)}`, 'bob')).body.vehicle.brand, 'Renault');
  assert.equal((await call('POST', '/api/invites/accept', 'bob', { token: invite.token })).body.vehicleId, ids.vehicle3);

  const shared = (await call('GET', '/api/vehicles', 'bob')).body.find((v: any) => v.id === ids.vehicle3);
  assert.equal(shared.role, 'driver');
  assert.equal(shared.ownerName, 'alice Silva');
  // O condutor regista abastecimentos, mas não apaga o veículo nem muda a foto
  assert.equal((await call('POST', '/api/fuel-records', 'bob', { vehicleId: ids.vehicle3, date: '2026-01-02', mileage: 90100, liters: 40, costPerLiter: 1.7, totalCost: 68, fuelType: 'diesel' })).status, 201);
  assert.equal((await call('DELETE', `/api/vehicles/${ids.vehicle3}`, 'bob')).status, 403);
  assert.equal((await call('PATCH', `/api/vehicles/${ids.vehicle3}`, 'bob', { imageUrl: 'https://upload.wikimedia.org/y.jpg' })).status, 403);
  assert.equal((await call('GET', `/api/vehicles/${ids.vehicle3}/members`, 'bob')).status, 403);
  assert.equal((await call('GET', `/api/vehicles/${ids.vehicle3}/members`, 'alice')).body[0].status, 'active');

  assert.equal((await call('DELETE', `/api/vehicles/${ids.vehicle3}/members/me`, 'bob')).status, 204, 'o condutor pode sair');
  assert.equal((await call('GET', '/api/vehicles', 'bob')).body.some((v: any) => v.id === ids.vehicle3), false);
  // O convite não serve duas vezes
  assert.equal((await call('POST', '/api/invites/accept', 'bob', { token: invite.token })).status, 404);
});

test('calendário, exportação de dados, configuração e relatórios', async () => {
  const cal = await call('POST', '/api/user/calendar', 'alice');
  const icsPath = new URL(cal.body.url).pathname;
  const ics = await call('GET', icsPath);
  assert.equal(ics.status, 200);
  assert.match(ics.body, /BEGIN:VCALENDAR/);
  assert.match(ics.body, /Pagar IUC – Renault Clio/);
  assert.equal((await call('GET', '/api/calendar/invalido.ics')).status, 404);

  const exported = await call('GET', '/api/user/export', 'alice');
  assert.equal(exported.status, 200);
  assert.ok(exported.body.vehicles.some((v: any) => v.vehicle.id === ids.vehicle3));
  assert.equal('password' in exported.body.user, false);

  const config = (await call('GET', '/api/config')).body;
  assert.equal(config.plans.premium.features.sharing, true);
  assert.equal(config.features.iot, false);

  const report = await call('GET', `/api/vehicles/${ids.vehicle3}/report`, 'alice');
  assert.equal(report.status, 200);
  assert.equal(report.body.totals.fuelCost, 68);
  assert.equal((await call('GET', '/api/reports/fleet.csv', 'alice')).status, 402, 'frota só no plano Empresas');
  await call('POST', '/api/billing/dev-activate', 'alice', { plan: 'business' });
  const csv = await call('GET', '/api/reports/fleet.csv', 'alice');
  assert.equal(csv.status, 200);
  assert.match(csv.body, /Matrícula;Marca;Modelo/);
});

test('lembretes: a tarefa diária envia cada aviso uma só vez', async () => {
  const { runNotifications, notificationStage } = await import('./notifications');
  // Etapas: 30/7/1 dias, no dia, em atraso; por km, por prioridade
  const now = new Date('2026-06-01T09:00:00Z');
  const at = (d: string) => ({ dueDate: new Date(d), priority: 'normal' });
  assert.equal(notificationStage(at('2026-06-20'), [30, 7, 1], now), 'd30');
  assert.equal(notificationStage(at('2026-06-05'), [30, 7, 1], now), 'd7');
  assert.equal(notificationStage(at('2026-06-02'), [30, 7, 1], now), 'd1');
  assert.equal(notificationStage(at('2026-06-01'), [30, 7, 1], now), 'today');
  assert.equal(notificationStage(at('2026-05-30'), [30, 7, 1], now), 'overdue');
  assert.equal(notificationStage(at('2026-08-01'), [30, 7, 1], now), null);
  assert.equal(notificationStage(at('2026-06-20'), [7], now), null, 'sem o aviso de 30 dias');
  assert.equal(notificationStage({ dueDate: null, priority: 'urgent' }, [30], now), 'km-urgent');

  // A Alice confirma o email e tem um IUC em atraso
  const verify = lastMail(email('alice'));
  await call('POST', '/api/auth/verify-email', undefined, { token: verify.token });
  await call('PATCH', `/api/vehicles/${ids.vehicle3}`, 'alice', { iucDue: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) });
  const aliceId = (await call('GET', '/api/auth/user', 'alice')).body.id;
  const before = lastMail(email('alice')).count;
  const run1 = await runNotifications(new Date(), aliceId);
  assert.equal(run1.emails, 1);
  const mail = lastMail(email('alice')).html;
  assert.match(mail, /IUC expirado/);
  assert.match(mail, /api\/notifications\/unsubscribe\?token=/);
  const run2 = await runNotifications(new Date(), aliceId);
  assert.equal(run2.emails, 0, 'não repete');
  assert.equal(lastMail(email('alice')).count, before + 1);

  // "Deixar de receber" desliga os emails
  const unsub = /api\/notifications\/unsubscribe\?token=([^"&<\s]+)/.exec(mail)![1];
  assert.equal((await call('GET', `/api/notifications/unsubscribe?token=${unsub}`)).status, 200);
  assert.equal((await call('GET', '/api/user/preferences', 'alice')).body.notificationPreferences.email, false);
});

test('feedback, erros do cliente e administração', async () => {
  assert.equal((await call('POST', '/api/feedback', 'alice', { message: 'Gosto muito da app', page: '/dashboard' })).status, 201);
  assert.equal((await call('POST', '/api/client-errors', undefined, { message: 'TypeError: x', url: '/dashboard' })).status, 204);
  assert.equal((await call('GET', '/api/admin/metrics', 'alice')).status, 403);
  process.env.ADMIN_EMAILS = email('alice');
  const metrics = await call('GET', '/api/admin/metrics', 'alice');
  assert.equal(metrics.status, 200);
  assert.ok(metrics.body.activation.withVehicle >= 1);
  assert.ok(metrics.body.feedback.some((f: any) => f.message === 'Gosto muito da app'));
  assert.equal((await call('GET', '/api/auth/user', 'alice')).body.isAdmin, true);
  delete process.env.ADMIN_EMAILS;
  await call('DELETE', `/api/vehicles/${ids.vehicle3}`, 'alice');
});
