// Upozornění občana a Web Push. Volá backend přes stejný původ, přihlášení je v cookie.

export type Notice = {
  id: number;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

const json = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json() as Promise<T>;
};

export const fetchNotices = async (): Promise<Notice[]> => (await json<{ items: Notice[] }>("/me/notifications")).items;

export const markNoticeRead = (id: number) => json<{ ok: boolean }>(`/me/notifications/${id}/read`, { method: "POST" });

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const urlBase64ToUint8Array = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

// Vrací true, když je odběr uložený na serveru. Bez VAPID klíče nebo bez souhlasu vrací false.
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  const { public_key, configured } = await json<{ public_key: string; configured: boolean }>("/push/vapid-public-key");
  if (!configured) return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key),
    }));
  const data = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await json<{ ok: boolean }>("/me/push-subscription", { method: "POST", body: JSON.stringify(data) });
  return true;
}
