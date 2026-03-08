# PrepTrack

> Dein Vorrat. Immer im Blick.

Offline-first Progressive Web App (PWA) für Prepper, Selbstversorger und alle, die ihren Vorrat im Griff haben wollen. Produkte scannen, MHD tracken, Benachrichtigungen erhalten.

## Features

- **Barcode-Scanner** — Produkte via Kamera scannen, automatische Erkennung via Open Food Facts API
- **Manuelle Erfassung** — Name, Kategorie, Lagerort, Menge, Einheit, Foto
- **MHD-Tracking** — Farbcodierte Ablaufwarnung (rot/orange/gelb/grün)
- **Dashboard** — Gesamtübersicht mit Statistiken und dringenden Produkten
- **Benachrichtigungen** — Lokale Push-Erinnerungen 30/14/7/3/1 Tage vor Ablauf
- **Mindestbestand** — Warnungen bei Unterschreitung des Zielbestands
- **Lagerort-Verwaltung** — Eigene Lagerorte anlegen und verwalten
- **Verbrauchslog** — Produkte als verbraucht markieren, Statistiken einsehen
- **Datenexport** — JSON-Backup und CSV-Export
- **Datenimport** — Backup wiederherstellen
- **Offline-first** — Vollständig offline nutzbar dank IndexedDB + Service Worker
- **Installierbar** — Als PWA auf Smartphone und Desktop installierbar
- **Dark Mode** — Standard-Darstellung mit optionalem Light Mode

## Tech Stack

| Kategorie | Technologie | Begründung |
|-----------|-------------|------------|
| Framework | React 18 + TypeScript | Interaktive SPA mit starkem Ecosystem |
| Bundler | Vite 6 | Schnelle Dev-Experience, optimaler Build |
| Styling | Tailwind CSS 3 | Utility-first, Dark Mode Support |
| State | Zustand | Leichtgewichtig, minimal boilerplate |
| Datenbank | Dexie.js (IndexedDB) | Offline-first, reaktive Queries |
| PWA | vite-plugin-pwa (Workbox) | Auto-Update, Runtime Caching |
| Scanner | @zxing/browser | Barcode/EAN Erkennung via Kamera |
| Icons | Lucide React | Konsistente, leichte SVG Icons |
| Animation | Framer Motion | Smooth UI Transitions |
| CI/CD | GitHub Actions | Auto-Deploy auf GitHub Pages |

## Setup & Installation

```bash
git clone https://github.com/BEKO2210/Prepper_Log.git
cd Prepper_Log
npm install
npm run dev
```

Die App ist dann unter `http://localhost:5173` verfügbar.

## Build

```bash
npm run build
npm run preview
```

## Deploy (GitHub Pages)

1. Repository auf GitHub pushen
2. Unter **Settings > Pages** die Source auf **GitHub Actions** setzen
3. Bei jedem Push auf `main` wird automatisch deployed

## PWA Installation

### Android (Chrome)
1. App im Browser öffnen
2. Banner "Installieren" antippen oder Menü > "App installieren"

### iOS (Safari)
1. App im Browser öffnen
2. Teilen-Button antippen
3. "Zum Home-Bildschirm" wählen

### Desktop (Chrome/Edge)
1. App im Browser öffnen
2. Installieren-Icon in der Adressleiste klicken

## Datenschutz

- Alle Daten werden **lokal** auf deinem Gerät gespeichert (IndexedDB)
- **Keine** externen Tracking-Dienste oder Analytics
- Die Open Food Facts API wird nur beim Barcode-Scan kontaktiert
- Vollständiger JSON-Export/-Import für Datenkontrolle

## License

MIT
