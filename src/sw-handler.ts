// Service Worker event handlers for PrepTrack PWA
// This file handles SW registration feedback in the main thread

export function registerSWEventHandlers(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      // Handle service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            // New service worker installed while old one still controls — update available
            console.log('[PrepTrack] Neues Update verfügbar.');
          }
        });
      });
    }).catch(() => {
      // Service Worker not available — non-critical
    });

    // Handle controller change (after skipWaiting in autoUpdate mode)
    // Reload page to ensure all assets are from the new SW cache
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      console.log('[PrepTrack] Service Worker aktualisiert. Seite wird neu geladen.');
      window.location.reload();
    });
  }
}
