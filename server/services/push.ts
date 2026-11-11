// Notificações push (Web Push / VAPID) para a app instalada (PWA) e browsers.
// Chaves VAPID: VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY no .env. Em desenvolvimento, sem elas,
// são geradas uma vez e guardadas em data/vapid.json (nunca em produção: as subscrições dependem delas).
import fs from 'fs';
import path from 'path';
import * as webpush from 'web-push';
import { BRAND } from '@shared/brand';
import { storage } from '../storage';

let keys: { publicKey: string; privateKey: string } | null | undefined;

function vapidKeys() {
  if (keys !== undefined) return keys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else if (process.env.NODE_ENV !== 'production') {
    const file = path.resolve('./data/vapid.json');
    if (fs.existsSync(file)) {
      keys = JSON.parse(fs.readFileSync(file, 'utf8'));
    } else {
      keys = webpush.generateVAPIDKeys();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(keys));
      console.log('🔑 Chaves VAPID de desenvolvimento geradas em data/vapid.json');
    }
  } else {
    keys = null;
  }
  if (keys) webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:${BRAND.supportEmail}`, keys.publicKey, keys.privateKey);
  return keys;
}

export const pushPublicKey = () => vapidKeys()?.publicKey ?? null;

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Envia para todos os dispositivos do utilizador. Remove subscrições expiradas. Devolve quantos receberam. */
export async function sendPush(userId: string, payload: PushPayload): Promise<number> {
  if (!vapidKeys()) return 0;
  const subs = await storage.getPushSubscriptions(userId);
  let delivered = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 24 * 3600 });
      delivered++;
    } catch (error: any) {
      // 404/410: o dispositivo cancelou a subscrição
      if (error?.statusCode === 404 || error?.statusCode === 410) await storage.deletePushSubscriptionById(sub.id);
      else console.error('Erro ao enviar push:', error?.statusCode ?? '', error?.body ?? error?.message);
    }
  }
  return delivered;
}
