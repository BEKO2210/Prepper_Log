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
            // New service worker available — notify user
            if (import.meta.env.DEV) console.log('[PrepTrack] Neues Update verfügbar. Seite neu laden.');
          }
        });
      });
    });

    // Handle controller change (after skip waiting)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (import.meta.env.DEV) console.log('[PrepTrack] Service Worker aktualisiert.');
    });
  }
}
