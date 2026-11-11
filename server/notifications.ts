// Lembretes: tarefa diária que gera os alertas de cada utilizador e os envia por email e push.
// Cada envio é reservado com um id determinístico (alerta + etapa + canal) antes de sair, por isso
// correr a tarefa duas vezes, ou em dois servidores, não repete notificações.
import type { Alert } from '@shared/schema';
import { effectivePlan } from '@shared/plans';
import { BRAND } from '@shared/brand';
import { storage } from './storage';
import { sendMail, appUrl } from './services/mailer';
import { sendPush } from './services/push';
import { signPurposeToken } from './jwtUtils';

export interface NotificationPrefs {
  email: boolean;
  push: boolean;
  leadDays: number[];
  weeklyDigest: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { email: true, push: true, leadDays: [30, 7, 1], weeklyDigest: false };

export async function notificationPrefs(userId: string): Promise<NotificationPrefs> {
  const prefs = (await storage.getPreferences(userId)) as { notificationPreferences?: Partial<NotificationPrefs> } | undefined;
  const p = { ...DEFAULT_NOTIFICATION_PREFS, ...(prefs?.notificationPreferences ?? {}) };
  const leadDays = Array.isArray(p.leadDays) ? p.leadDays.map(Number).filter((n) => [30, 7, 1].includes(n)) : DEFAULT_NOTIFICATION_PREFS.leadDays;
  return { email: p.email !== false, push: p.push !== false, leadDays, weeklyDigest: p.weeklyDigest === true };
}

const DAY = 86_400_000;
const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/**
 * Etapa de notificação de um alerta, ou null se ainda não é altura de avisar.
 * Por data: "d30"/"d7"/"d1" (a menor antecedência escolhida já alcançada), "today" ou "overdue".
 * Por km: uma vez por nível de prioridade (normal → high → urgent).
 */
export function notificationStage(alert: Pick<Alert, 'dueDate' | 'priority'>, leadDays: number[], now = new Date()): string | null {
  if (alert.dueDate) {
    const days = Math.round((startOfDay(new Date(alert.dueDate)) - startOfDay(now)) / DAY);
    if (days < 0) return 'overdue';
    if (days === 0) return 'today';
    const reached = [...leadDays].sort((a, b) => a - b).find((lead) => days <= lead);
    return reached ? `d${reached}` : null;
  }
  return `km-${alert.priority}`;
}

const unsubscribeUrl = (userId: string) =>
  appUrl(`/api/notifications/unsubscribe?token=${encodeURIComponent(signPurposeToken(userId, 'unsubscribe', '400d'))}`);

const isoWeek = (d: Date) => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const week = Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / DAY + 1) / 7);
  return `${t.getUTCFullYear()}-W${week}`;
};

export interface RunResult { users: number; emails: number; pushes: number }

/** Envia os lembretes devidos a todos os utilizadores (ou só a um, para testes). */
export async function runNotifications(now = new Date(), onlyUserId?: string): Promise<RunResult> {
  const result: RunResult = { users: 0, emails: 0, pushes: 0 };
  const users = (await storage.getNotifiableUsers()).filter((u) => !onlyUserId || u.id === onlyUserId);

  for (const user of users) {
    try {
      const prefs = await notificationPrefs(user.id);
      const plan = effectivePlan(user.plan, user.planExpiresAt, now);
      const wantsEmail = prefs.email && user.emailVerified && !!user.email;
      const wantsPush = prefs.push && plan.features.pushNotifications;
      const isDigestDay = prefs.weeklyDigest && now.getUTCDay() === 1;
      if (!wantsEmail && !wantsPush && !isDigestDay) continue;
      result.users++;

      await storage.syncAlerts(user.id);
      const [alerts, vehicles] = await Promise.all([storage.getUserAlerts(user.id), storage.getUserVehicles(user.id)]);
      const vehicleName = (id: string) => {
        const v = vehicles.find((x) => x.id === id);
        return v ? `${v.brand} ${v.model} (${v.licensePlate})` : 'O seu veículo';
      };
      const due = alerts
        .map((alert) => ({ alert, stage: notificationStage(alert, prefs.leadDays, now) }))
        .filter((x): x is { alert: Alert; stage: string } => x.stage !== null);

      // Email: um só, com todos os prazos novos desta execução
      if (wantsEmail && due.length) {
        const claimed: { id: string; alert: Alert }[] = [];
        for (const { alert, stage } of due) {
          const id = `${alert.id}:${stage}:email`;
          if (await storage.claimNotification(id, user.id, alert.id, 'email', stage)) claimed.push({ id, alert });
        }
        if (claimed.length) {
          const ok = await sendMail({
            to: user.email!,
            subject: claimed.length === 1 ? `${claimed[0].alert.title} · ${vehicleName(claimed[0].alert.vehicleId)}` : `${claimed.length} prazos dos seus veículos`,
            paragraphs: [
              `Olá${user.firstName ? ` ${user.firstName}` : ''},`,
              ...claimed.map(({ alert }) => `• ${vehicleName(alert.vehicleId)}: ${alert.title}. ${alert.description ?? ''}`.trim()),
              'Marque como feito na app para atualizarmos o próximo prazo.',
            ],
            action: { label: 'Ver na app', url: appUrl('/dashboard') },
            footer: ['Recebe este email porque ativou os lembretes por email.', `Deixar de receber: ${unsubscribeUrl(user.id)}`],
          });
          if (ok) result.emails++;
          else for (const c of claimed) await storage.releaseNotification(c.id);
        }
      }

      // Push: uma notificação por alerta
      if (wantsPush) {
        for (const { alert, stage } of due) {
          const id = `${alert.id}:${stage}:push`;
          if (!(await storage.claimNotification(id, user.id, alert.id, 'push', stage))) continue;
          const delivered = await sendPush(user.id, {
            title: alert.title,
            body: `${vehicleName(alert.vehicleId)}${alert.description ? ` · ${alert.description}` : ''}`,
            url: '/dashboard',
            tag: alert.id,
          });
          if (delivered > 0) result.pushes++;
          else await storage.releaseNotification(id); // sem dispositivos: tenta de novo quando houver
        }
      }

      // Resumo semanal (segunda-feira): tudo o que vence nos próximos 30 dias
      if (isDigestDay && user.emailVerified && user.email) {
        const id = `digest:${user.id}:${isoWeek(now)}`;
        if (await storage.claimNotification(id, user.id, null, 'email', 'digest')) {
          const appointments = (await storage.getUserAppointments(user.id))
            .filter((a) => a.status !== 'completed' && a.status !== 'cancelled' && new Date(a.scheduledDate).getTime() - now.getTime() < 30 * DAY && new Date(a.scheduledDate) >= now);
          const lines = [
            ...alerts.map((a) => `• ${vehicleName(a.vehicleId)}: ${a.title}`),
            ...appointments.map((a) => `• Marcação: ${a.title} a ${new Date(a.scheduledDate).toLocaleDateString('pt-PT')} às ${a.scheduledTime}`),
          ];
          const ok = await sendMail({
            to: user.email,
            subject: `Resumo semanal · ${BRAND.name}`,
            paragraphs: [`Olá${user.firstName ? ` ${user.firstName}` : ''}, este é o resumo da semana:`, ...(lines.length ? lines : ['Nada a vencer nos próximos 30 dias. Tudo em dia!'])],
            action: { label: 'Abrir a app', url: appUrl('/dashboard') },
            footer: ['Pode desativar o resumo semanal nas Definições.', `Deixar de receber emails: ${unsubscribeUrl(user.id)}`],
          });
          if (ok) result.emails++;
          else await storage.releaseNotification(id);
        }
      }
    } catch (error) {
      console.error(`Erro nas notificações do utilizador ${user.id}:`, error instanceof Error ? error.message : error);
    }
  }
  return result;
}

/**
 * Corre a tarefa uma vez por dia, a partir da hora NOTIFY_HOUR (UTC, 9 por omissão).
 * Desligar com NOTIFICATIONS_ENABLED=false (ex.: em testes ou numa instância secundária).
 */
export function startNotificationScheduler() {
  if (process.env.NOTIFICATIONS_ENABLED === 'false') return null;
  const hour = Number(process.env.NOTIFY_HOUR ?? 9);
  let lastRun = '';
  const tick = async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (now.getUTCHours() < hour || lastRun === today) return;
    lastRun = today;
    const r = await runNotifications(now).catch((e) => { console.error('Erro na tarefa de notificações:', e); return null; });
    if (r) console.log(`🔔 Lembretes: ${r.users} utilizadores, ${r.emails} emails, ${r.pushes} push`);
  };
  const timer = setInterval(tick, 10 * 60 * 1000);
  timer.unref();
  setTimeout(tick, 30_000).unref();
  return timer;
}
