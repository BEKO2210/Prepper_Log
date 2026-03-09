import { db } from './db';
import { getDaysUntilExpiry } from './utils';
import i18n from '../i18n/i18n';

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
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

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
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const products = await db.products
    .filter((p) => !p.archived)
    .toArray();

  const today = new Date().toISOString().split('T')[0];
  const t = i18n.t.bind(i18n);

  for (const product of products) {
    const daysLeft = getDaysUntilExpiry(product.expiryDate);

    for (const threshold of NOTIFICATION_THRESHOLDS) {
      // Use <= to catch the threshold even if timezone differences cause off-by-one
      if (daysLeft <= threshold) {
        const existingNotification = await db.notificationSchedules
          .where('[productId+daysBefore]')
          .equals([product.id!, threshold])
          .first();

        if (!existingNotification?.sent) {
          const title =
            daysLeft <= 0
              ? t('notifications.expiredTitle', { name: product.name })
              : t('notifications.expiringTitle', { name: product.name });

          const body =
            daysLeft <= 0
              ? t('notifications.expiredBody', { name: product.name, location: product.storageLocation })
              : t('notifications.expiringBody', { name: product.name, location: product.storageLocation, days: daysLeft });

          showLocalNotification(title, body, `expiry-${product.id}-${threshold}`);

          if (existingNotification) {
            await db.notificationSchedules.update(existingNotification.id!, {
              sent: true,
              notifyAt: today,
            });
          } else {
            await db.notificationSchedules.add({
              productId: product.id!,
              productName: product.name,
              expiryDate: product.expiryDate,
              notifyAt: today,
              daysBefore: threshold,
              sent: true,
            });
          }
        }
        // Only fire the highest matching threshold per product
        break;
      }
    }
  }
}

export function startNotificationChecker(): ReturnType<typeof setInterval> {
  checkAndNotifyExpiringProducts().catch((err) =>
    console.error('[PrepTrack] Benachrichtigungsprüfung fehlgeschlagen:', err)
  );
  return setInterval(() => {
    checkAndNotifyExpiringProducts().catch((err) =>
      console.error('[PrepTrack] Benachrichtigungsprüfung fehlgeschlagen:', err)
    );
  }, 1000 * 60 * 60);
}
