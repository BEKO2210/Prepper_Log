// Service Worker event handlers for PrepTrack PWA
// This file handles SW registration feedback in the main thread

export function registerSWEventHandlers(): void {
  if (!('serviceWorker' in navigator)) return;

  // Only reload the page when a *genuine* update activates — i.e. a new SW
  // installed while an old one was already controlling this page. Without this
  // guard, `controllerchange` also fires on the very first load (clientsClaim),
  // which would reload the freshly opened app and can blank a state-based route
  // until a manual refresh.
  let updateAvailable = false;
  let refreshing = false;

  navigator.serviceWorker.ready.then((registration) => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          updateAvailable = true;
          console.log('[PrepTrack] Neues Update verfügbar.');
        }
      });
    });
  }).catch(() => {
    // Service Worker not available — non-critical
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !updateAvailable) return;
    refreshing = true;
    console.log('[PrepTrack] Service Worker aktualisiert. Seite wird neu geladen.');
    window.location.reload();
  });
}
