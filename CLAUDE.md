# CLAUDE.md — PrepTrack Projektkontext

## Projekt

PrepTrack — Offline-first PWA zur Vorratsverwaltung.
React 18 + TypeScript, Vite 6, Tailwind CSS 3, Zustand, Dexie.js (IndexedDB).
Sprachen: Deutsch (de), Englisch (en), Portugiesisch (pt), Arabisch (ar). Lizenz: Apache 2.0.

## Befehle

```
npm run dev          # Dev-Server (localhost:5173)
npm run build        # Production Build (tsc + vite)
npm run test         # Vitest (15 Tests, src/lib/utils.test.ts)
npm run preview      # Build lokal testen
npx tsc --noEmit     # Type-Check ohne Build
```

## Architektur

Routing über Zustand Store (`useAppStore.currentPage`), NICHT React Router.
Pages: `dashboard | products | add | scanner | settings | stats`

```
src/
├── App.tsx                    # Router: rendert Page basierend auf currentPage
├── main.tsx                   # Entry, seedDefaults(), SW-Handler
├── sw-handler.ts              # Service Worker Update-Benachrichtigung
├── types/index.ts             # Alle Interfaces, Types, Konstanten
├── store/useAppStore.ts       # Zustand: Navigation, Filter, Editing, Scan
├── lib/
│   ├── db.ts                  # Dexie DB, CRUD, Export/Import, seedDefaults
│   ├── utils.ts               # MHD-Logik, Formatierung, compressImage, lookupBarcode
│   ├── utils.test.ts          # Unit Tests
│   └── notifications.ts       # Lokale Push-Benachrichtigungen
├── hooks/
│   ├── useDarkMode.ts         # Dark/Light Toggle (localStorage)
│   ├── useOnlineStatus.ts     # Online/Offline Detection
│   └── usePWAInstall.ts       # PWA Install Prompt + iOS Detection
└── components/
    ├── Dashboard.tsx           # StatRings, MHD-Balken, dringende Produkte
    ├── ProductList.tsx         # Liste mit Suche/Filter, Archiv, CRUD
    ├── ProductForm.tsx         # Add/Edit mit Draft-Persist (sessionStorage)
    ├── BarcodeScanner.tsx      # ZXing Scanner, Duplikat-Check, API-Lookup
    ├── Statistics.tsx          # Verbrauchsstatistiken
    ├── Settings.tsx            # Theme, Notifications, Lagerorte, Export/Import
    ├── Navigation.tsx          # Bottom Nav (6 Items)
    ├── StatRing.tsx            # SVG Kreisdiagramm
    ├── OfflineBanner.tsx       # Offline-Indikator (Framer Motion)
    ├── PWAInstallPrompt.tsx    # Install-Hinweis
    └── ImageCaptureModal.tsx   # Kamera-Modal (aktuell nicht verwendet)
```

## Datenbank (Dexie.js / IndexedDB)

DB-Name: `PrepTrackDB`, aktuell Version 2.

```
products:           ++id, name, barcode, category, storageLocation, expiryDate, archived, createdAt
storageLocations:   ++id, name
consumptionLogs:    ++id, productId, consumedAt
notificationSchedules: ++id, productId, notifyAt, sent, [productId+daysBefore]
```

Product-Felder: `id?, name, barcode?, category, storageLocation, quantity, unit, expiryDate, expiryPrecision, photo?, minStock?, notes?, archived, createdAt, updatedAt`

10 Kategorien: konserven, wasser, medizin, werkzeug, hygiene, lebensmittel, getranke, elektronik, kleidung, sonstiges
10 Einheiten: Stück, Liter, kg, g, ml, Packung, Dose, Flasche, Karton, Palette
8 Standard-Lagerorte: Keller, Garage, Küche, Dachboden, Vorratsraum, Bunker, Auto, Gartenhaus

## State Management

`useAppStore` (Zustand):
- `currentPage` / `setPage(page)` — Navigation
- `filters` / `setFilter(key, value)` — Produktliste-Filter
- `editingProductId` / `setEditingProductId(id)` — Bearbeitung (setzt Page auf 'add')
- `scannedData` / `navigateToAddWithScan(data)` — Scanner → Formular
- `notificationsEnabled` / `setNotificationsEnabled(enabled)` — localStorage-persistent

Beim App-Start: `getInitialPage()` prüft sessionStorage auf Form-Draft (Kamera-Reload-Fix).

## Wichtige Patterns

- **Form-Draft-Persist**: ProductForm speichert State in sessionStorage bevor Kamera öffnet (Mobile-PWA wird aus RAM entladen). Store startet auf 'add' wenn Draft existiert.
- **Kamera-Button**: Aktuell per `className="hidden"` deaktiviert, Code bleibt erhalten.
- **Version**: Wird aus `package.json` importiert (`import { version } from '../../package.json'`), erscheint in Settings + JSON-Export.
- **Export**: JSON ohne Fotos (Platzhalter `[FOTO]`), CSV mit BOM für Umlaute.
- **Import**: Duplikat-Erkennung (Name + MHD + Lagerort). `ImportResult` Klasse für Teil-Erfolg.
- **BarcodeScanner**: Lazy-loaded (`React.lazy`). Nutzt `@zxing/browser`, sucht Rückkamera. Duplikat-Popup wenn Barcode schon existiert. Online: Open Food Facts API Lookup.
- **Notifications**: Lokal via `Notification` API. Checker läuft alle 6h. 30/14/7/3/1 Tage vor MHD.
- **Dark Mode**: CSS-Klasse auf `<html>`, localStorage-persistent, Default: dark.

## Build & Deploy

- Vite base: `./` lokal, `/Prepper_Log/` für GitHub Pages (`GITHUB_PAGES` env var)
- PWA: `vite-plugin-pwa` mit autoUpdate, Workbox für API/Font/Image Caching
- CI/CD: `.github/workflows/deploy.yml` — Push auf main → Build + Test + Deploy auf GitHub Pages
- Tailwind: Custom primary/olive/khaki Palette, Fonts: Inter, Bebas Neue, JetBrains Mono

## Stilregeln

- Alle UI-Texte auf Deutsch mit korrekten Umlauten (ä, ö, ü, ß)
- Tailwind-Klassen, keine separaten CSS-Dateien (außer globals in index.css)
- Lucide React Icons, keine anderen Icon-Libraries
- `noUnusedLocals: true` in tsconfig — unbenutzte Imports/Variablen = Build-Fehler
- Semikolon-frei bei Tailwind-Klassen, Standard TypeScript-Formatting
