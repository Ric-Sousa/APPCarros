// Notificações push (Web Push) neste dispositivo, através do service worker (client/public/sw.js).
import { post } from "@/lib/apiUtils";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Chave VAPID (base64url) → bytes, como o PushManager exige. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Registo do service worker (também usado em desenvolvimento, para poder testar o push). */
async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? navigator.serviceWorker.register("/sw.js");
}

export type PushStatus = "unsupported" | "denied" | "subscribed" | "unsubscribed";

export async function pushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "subscribed" : "unsubscribed";
}

/** Pede autorização, subscreve e regista a subscrição no servidor (402 se o plano não incluir push). */
export async function subscribePush(vapidPublicKey: string) {
  if (!pushSupported()) throw new Error("Este navegador não suporta notificações push.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("A autorização para notificações foi recusada no navegador.");
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
  const json = sub.toJSON();
  try {
    await post("/api/push/subscribe", { endpoint: json.endpoint, keys: json.keys });
  } catch (error) {
    await sub.unsubscribe().catch(() => {});
    throw error;
  }
}

export async function unsubscribePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await post("/api/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}
