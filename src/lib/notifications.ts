import { db } from './db';
import { getDaysUntilExpiry } from './utils';

const NOTIFICATION_THRESHOLDS = [30, 14, 7, 3, 1, 0];

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function showLocalNotification(
  title: string,
  body: string,
  tag?: string
): void {
  if (Notification.permission !== 'granted') return;

  new Notification(title, {
    body,
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    tag: tag || `preptrack-${Date.now()}`,
    requireInteraction: false,
    silent: false,
  });
}

export async function checkAndNotifyExpiringProducts(): Promise<void> {
  if (Notification.permission !== 'granted') return;

  const products = await db.products
    .filter((p) => !p.archived)
    .toArray();

  const today = new Date().toISOString().split('T')[0];

  for (const product of products) {
    const daysLeft = getDaysUntilExpiry(product.expiryDate);

    for (const threshold of NOTIFICATION_THRESHOLDS) {
      if (daysLeft === threshold) {
        const existingNotification = await db.notificationSchedules
          .where('[productId+daysBefore]')
          .equals([product.id!, threshold])
          .first();

        if (!existingNotification?.sent) {
          const title =
            daysLeft <= 0
              ? `${product.name} ist abgelaufen!`
              : `${product.name} läuft bald ab`;

          const body =
            daysLeft <= 0
              ? `Das Produkt "${product.name}" in "${product.storageLocation}" ist abgelaufen.`
              : `Noch ${daysLeft} Tag${daysLeft !== 1 ? 'e' : ''} bis zum Ablauf von "${product.name}" in "${product.storageLocation}".`;

          showLocalNotification(title, body, `expiry-${product.id}-${threshold}`);

          await db.notificationSchedules.put({
            productId: product.id!,
            productName: product.name,
            expiryDate: product.expiryDate,
            notifyAt: today,
            daysBefore: threshold,
            sent: true,
          });
        }
      }
    }
  }
}

export function startNotificationChecker(): ReturnType<typeof setInterval> {
  checkAndNotifyExpiringProducts();
  return setInterval(checkAndNotifyExpiringProducts, 1000 * 60 * 60);
}
