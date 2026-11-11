// Conta e serviço: configuração pública, notificações (push/email), calendário, feedback, erros do cliente e administração.
import type { Express, Response } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { BRAND } from '@shared/brand';
import { PLANS } from '@shared/plans';
import type { Vehicle, MaintenanceAppointment } from '@shared/schema';
import { storage } from '../storage';
import { requireAuth, requireFeature, userId, HttpError, limiter } from '../http';
import { verifyPurposeToken } from '../jwtUtils';
import { pushPublicKey, sendPush } from '../services/push';
import { sendMail, appUrl, mailMode } from '../services/mailer';
import { runNotifications } from '../notifications';
import { isAdminEmail } from './auth';
import { iotEnabled } from './mobility';
import { paymentsProvider } from './billing';

const ATTRIBUTIONS = [
  { name: 'DGEG', url: 'https://precoscombustiveis.dgeg.gov.pt', note: 'Preços de combustível (Direção-Geral de Energia e Geologia)' },
  { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright', note: 'Mapas e geocodificação © contribuidores do OpenStreetMap' },
  { name: 'OpenRouteService', url: 'https://openrouteservice.org', note: 'Cálculo de rotas' },
  { name: 'Open Charge Map', url: 'https://openchargemap.org', note: 'Postos de carregamento' },
  { name: 'OpenWeather', url: 'https://openweathermap.org', note: 'Meteorologia' },
  { name: 'Wikimedia Commons', url: 'https://commons.wikimedia.org', note: 'Fotos de veículos (licenças indicadas em cada foto)' },
  { name: 'Unsplash', url: 'https://unsplash.com', note: 'Fotos de veículos' },
];

// ---------- Calendário (.ics) ----------
const icsDate = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function buildCalendar(vehicles: Vehicle[], appointments: MaintenanceAppointment[], now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${BRAND.name}//Prazos//PT`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(`${BRAND.name} – prazos dos veículos`)}`, 'X-WR-TIMEZONE:Europe/Lisbon', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H'];
  const alarm = (days: number, text: string) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(text)}`, `TRIGGER:-P${days}D`, 'END:VALARM'];
  for (const v of vehicles) {
    const name = `${v.brand} ${v.model} (${v.licensePlate})`;
    const deadlines: [Date | null, string, string][] = [
      [v.iucDue, 'iuc', `Pagar IUC – ${name}`],
      [v.inspectionDue, 'inspection', `Inspeção periódica – ${name}`],
      [v.insuranceDue, 'insurance', `Renovar seguro – ${name}`],
    ];
    for (const [date, kind, title] of deadlines) {
      if (!date) continue;
      const d = new Date(date);
      lines.push('BEGIN:VEVENT', `UID:${v.id}-${kind}-${icsDate(d)}@${BRAND.name.toLowerCase()}`, `DTSTAMP:${icsStamp(now)}`,
        `DTSTART;VALUE=DATE:${icsDate(d)}`, `DTEND;VALUE=DATE:${icsDate(new Date(d.getTime() + 86_400_000))}`,
        `SUMMARY:${icsText(title)}`, `DESCRIPTION:${icsText(`Prazo registado no ${BRAND.name}. ${appUrl(`/vehicle/${v.id}`)}`)}`,
        ...alarm(7, title), ...alarm(1, title), 'END:VEVENT');
    }
  }
  for (const a of appointments) {
    if (a.status === 'cancelled') continue;
    const day = new Date(a.scheduledDate);
    const [h, m] = (a.scheduledTime ?? '09:00').split(':').map(Number);
    // Hora local de Portugal sem fuso no ficheiro (TZID); simples e lido corretamente pelos calendários
    const local = `${icsDate(day)}T${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}00`;
    const endMin = h * 60 + m + (a.estimatedDuration ?? 60);
    const end = `${icsDate(day)}T${String(Math.min(23, Math.floor(endMin / 60))).padStart(2, '0')}${String(endMin % 60).padStart(2, '0')}00`;
    lines.push('BEGIN:VEVENT', `UID:appointment-${a.id}@${BRAND.name.toLowerCase()}`, `DTSTAMP:${icsStamp(now)}`,
      `DTSTART;TZID=Europe/Lisbon:${local}`, `DTEND;TZID=Europe/Lisbon:${end}`, `SUMMARY:${icsText(a.title)}`,
      ...(a.serviceLocation ? [`LOCATION:${icsText(a.serviceLocation)}`] : []), ...alarm(1, a.title), 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  // Linhas de no máximo 75 octetos (RFC 5545)
  return lines.map((l) => (l.length > 74 ? l.match(/.{1,74}/g)!.join('\r\n ') : l)).join('\r\n') + '\r\n';
}

async function sendCalendar(res: Response, ownerId: string) {
  const [vehicles, appointments] = await Promise.all([storage.getUserVehicles(ownerId), storage.getUserAppointments(ownerId)]);
  res.type('text/calendar; charset=utf-8').setHeader('Content-Disposition', `inline; filename="${BRAND.name.toLowerCase()}-prazos.ics"`);
  res.send(buildCalendar(vehicles, appointments));
}

const htmlPage = (title: string, body: string) => `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:48px auto;padding:0 16px;color:#111827"><h1 style="color:#2563eb">${BRAND.name}</h1>${body}
<p><a href="${appUrl('/definicoes')}">Abrir as definições</a></p></body></html>`;

export function registerAccountRoutes(app: Express) {
  // Configuração pública (o cliente adapta a interface ao que está ativo)
  app.get('/api/config', (_req, res) => {
    res.json({
      appName: BRAND.name,
      features: {
        plateLookup: !!process.env.VEHICLE_API_URL,
        iot: iotEnabled(),
        push: !!pushPublicKey(),
        payments: paymentsProvider(),
        fuelPrices: true,
        email: mailMode(),
      },
      vapidPublicKey: pushPublicKey(),
      plans: PLANS,
      attributions: ATTRIBUTIONS,
    });
  });

  // ---------- Push ----------
  app.post('/api/push/subscribe', requireAuth, requireFeature('pushNotifications', 'As notificações no telemóvel estão incluídas no plano Premium.'), async (req, res) => {
    const sub = z.object({
      endpoint: z.string().url().max(2000).refine((u) => u.startsWith('https://'), 'Endpoint inválido'),
      keys: z.object({ p256dh: z.string().min(10).max(255), auth: z.string().min(8).max(255) }),
    }).parse(req.body);
    await storage.addPushSubscription(userId(req), { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth });
    await storage.trackEvent(userId(req), 'push_enabled');
    res.status(201).json({ success: true });
  });

  app.post('/api/push/unsubscribe', requireAuth, async (req, res) => {
    const { endpoint } = z.object({ endpoint: z.string().max(2000) }).parse(req.body);
    await storage.removePushSubscription(userId(req), endpoint);
    res.status(204).send();
  });

  app.post('/api/push/test', requireAuth, limiter(10, 'testes', 15 * 60 * 1000), async (req, res) => {
    const delivered = await sendPush(userId(req), { title: `${BRAND.name}: teste`, body: 'As notificações estão a funcionar neste dispositivo.', url: '/definicoes', tag: 'test' });
    if (!delivered) throw new HttpError(400, 'Nenhum dispositivo com notificações ativas.');
    res.status(204).send();
  });

  app.post('/api/notifications/test-email', requireAuth, limiter(5, 'testes', 15 * 60 * 1000), async (req, res) => {
    const user = await storage.getUser(userId(req));
    if (!user?.email) throw new HttpError(400, 'A conta não tem email.');
    if (!user.emailVerifiedAt) throw new HttpError(400, 'Confirme primeiro o seu email.');
    const ok = await sendMail({
      to: user.email,
      subject: `Teste de lembretes · ${BRAND.name}`,
      paragraphs: [`Olá${user.firstName ? ` ${user.firstName}` : ''},`, 'Os lembretes por email estão a funcionar. Vai receber avisos antes dos prazos dos seus veículos.'],
      action: { label: 'Abrir a app', url: appUrl('/dashboard') },
    });
    if (!ok) throw new HttpError(502, 'Não foi possível enviar o email agora.');
    res.status(204).send();
  });

  // Link "Deixar de receber" dos emails (sem login)
  app.get('/api/notifications/unsubscribe', async (req, res) => {
    const id = verifyPurposeToken(String(req.query.token ?? ''), 'unsubscribe');
    if (!id) return res.status(400).type('html').send(htmlPage('Link inválido', '<p>Este link é inválido ou expirou.</p>'));
    const prefs = ((await storage.getPreferences(id)) ?? {}) as Record<string, any>;
    await storage.setPreferences(id, { ...prefs, notificationPreferences: { ...(prefs.notificationPreferences ?? {}), email: false, weeklyDigest: false } });
    res.type('html').send(htmlPage('Emails desativados', '<p>Deixou de receber lembretes por email. Pode voltar a ativá-los nas definições.</p>'));
  });

  // ---------- Calendário ----------
  const calendarUrl = (token: string) => appUrl(`/api/calendar/${token}.ics`);

  app.get('/api/user/calendar', requireAuth, async (req, res) => {
    const user = await storage.getUserWithPassword(userId(req));
    res.json({ url: user?.calendarToken ? calendarUrl(user.calendarToken) : null });
  });

  // Cria (ou troca, invalidando o anterior) o endereço secreto de subscrição
  app.post('/api/user/calendar', requireAuth, async (req, res) => {
    const token = randomBytes(24).toString('base64url');
    await storage.setUserFields(userId(req), { calendarToken: token });
    await storage.trackEvent(userId(req), 'calendar_enabled');
    res.json({ url: calendarUrl(token) });
  });

  app.get('/api/calendar.ics', requireAuth, async (req, res) => {
    await sendCalendar(res, userId(req));
  });

  // Subscrição pelo Google/Apple/Outlook: o token secreto no endereço identifica o utilizador
  app.get('/api/calendar/:token.ics', limiter(120, 'pedidos de calendário', 60 * 60 * 1000), async (req, res) => {
    const user = await storage.findUserByCalendarToken(String(req.params.token));
    if (!user) throw new HttpError(404, 'Calendário não encontrado');
    await sendCalendar(res, user.id);
  });

  // ---------- Feedback e erros ----------
  app.post('/api/feedback', requireAuth, limiter(10, 'mensagens', 60 * 60 * 1000), async (req, res) => {
    const { message, page } = z.object({ message: z.string().trim().min(3, 'Escreva a sua mensagem').max(5000), page: z.string().max(255).optional() }).parse(req.body);
    const user = await storage.getUser(userId(req));
    await storage.addFeedback(userId(req), message, page ?? null);
    await sendMail({
      to: process.env.SUPPORT_EMAIL || BRAND.supportEmail,
      subject: `Feedback de ${user?.email ?? 'utilizador'}`,
      paragraphs: [message, `Página: ${page ?? '-'}`, `Utilizador: ${user?.email ?? userId(req)}`],
    });
    res.status(201).json({ success: true });
  });

  // Erros do browser (sem dados pessoais: mensagem, stack e página)
  app.post('/api/client-errors', limiter(30, 'relatórios', 15 * 60 * 1000), (req, res) => {
    const { message, stack, url } = z.object({ message: z.string().max(1000), stack: z.string().max(5000).optional(), url: z.string().max(500).optional() }).parse(req.body);
    console.error(`[cliente] ${message} @ ${url ?? '?'}\n${(stack ?? '').split('\n').slice(0, 5).join('\n')}`);
    res.status(204).send();
  });

  // ---------- Administração (ADMIN_EMAILS) ----------
  const requireAdmin = async (req: any, _res: Response, next: (e?: unknown) => void) => {
    const user = await storage.getUser(userId(req));
    if (!isAdminEmail(user?.email)) return next(new HttpError(403, 'Acesso reservado.'));
    next();
  };

  app.get('/api/admin/metrics', requireAuth, requireAdmin, async (_req, res) => {
    res.json(await storage.adminMetrics());
  });

  // Corre já a tarefa de lembretes (testes / suporte)
  app.post('/api/admin/run-notifications', requireAuth, requireAdmin, async (_req, res) => {
    res.json(await runNotifications());
  });
}
