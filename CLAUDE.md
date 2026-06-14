# CLAUDE.md — PrepTrack Projektkontext

## Projekt

PrepTrack — Offline-first PWA zur Vorratsverwaltung.
React 18 + TypeScript, Vite 6, Tailwind CSS 3, Zustand, Dexie.js (IndexedDB).
Sprachen: Deutsch (de), Englisch (en), Portugiesisch (pt), Arabisch (ar), Italienisch (it), Französisch (fr). Lizenz: Apache 2.0.

## Befehle

```
npm run dev          # Dev-Server (localhost:5173)
npm run build        # Production Build (tsc + vite)
npm run test         # Vitest Unit-Tests (src/lib/*.test.ts, src/components/*.test.tsx)
npm run test:e2e     # Playwright E2E (e2e/, gegen Production-Build)
npm run preview      # Build lokal testen
npx tsc --noEmit     # Type-Check ohne Build
```

Version: **2.0.0 (Stable)**. Patch-Version wird bei jedem Merge auf `main`
automatisch per CI erhöht (siehe `deploy.yml`).

## Architektur

Routing über Zustand Store (`useAppStore.currentPage`), NICHT React Router.
Pages: `dashboard | products | add | settings | stats | preparedness`

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
│   ├── preparedness.ts        # Krisenfestigkeit-Score, Wasser-Reichweite, Einkaufsliste
│   ├── dateOcr.ts             # Offline-MHD-OCR + Datums-Parser (parseExpiryDate)
│   ├── sync.ts / syncConfig.ts# Optionaler self-hosted LAN-Sync
│   ├── notifications.ts        # Lokale Push-Benachrichtigungen
│   └── *.test.ts              # Vitest Unit-Tests
├── i18n/                       # i18next-Konfig + locales/{de,en,pt,ar,it,fr}
├── hooks/
│   ├── useDarkMode.ts         # Dark/Light Toggle (localStorage)
│   ├── useOnlineStatus.ts     # Online/Offline Detection
│   ├── useModal.ts            # Modal-Verhalten (Fokus-Falle, Escape)
│   └── usePWAInstall.ts       # PWA Install Prompt + iOS Detection
└── components/
    ├── Dashboard.tsx           # StatRings, MHD-Balken, Krisenfestigkeit-Karte
    ├── Preparedness.tsx        # Krisen-Rechner, Score-Ring, Einkaufsliste
    ├── OnboardingModal.tsx     # Geführtes Erst-Onboarding
    ├── ProductList.tsx         # Liste mit Suche/Filter, Archiv, CRUD
    ├── ProductForm.tsx         # Add/Edit, Draft-Persist, MHD-OCR
    ├── BarcodeScanner.tsx      # ZXing Scanner, Duplikat-Check, API-Lookup
    ├── Statistics.tsx          # Verbrauchsstatistiken
    ├── Settings.tsx            # Theme, Notifications, Lagerorte, Export/Import, Sync
    ├── SyncHomeServerGuide.tsx # Anleitung für den LAN-Sync-Server
    ├── Navigation.tsx          # Bottom Nav (5 Items + FAB)
    ├── StatRing.tsx / CountUp.tsx # SVG-Ring + animierte Kennzahlen
    ├── WhatsNewModal.tsx       # "Was ist neu" (aus Commit-Historie)
    ├── OfflineBanner.tsx       # Offline-Indikator (Framer Motion)
    ├── PWAInstallPrompt.tsx    # Install-Hinweis
    └── ErrorBoundary.tsx       # Fehler-Fallback-UI
```

E2E-Tests in `e2e/` (Playwright). Offline-OCR-Assets in `public/tesseract/`,
TWA-Konfig in `twa-manifest.json`, Play-Store-Anleitung in `docs/PLAY_STORE.md`.

## Datenbank (Dexie.js / IndexedDB)

DB-Name: `PrepTrackDB`, aktuell Version 3 (mit `syncId` + `updatedAt` für Sync).

```
products:           ++id, syncId, name, barcode, category, storageLocation, expiryDate, archived, createdAt
storageLocations:   ++id, syncId, name
consumptionLogs:    ++id, syncId, productId, consumedAt
notificationSchedules: ++id, productId, notifyAt, sent, [productId+daysBefore]
syncQueue / syncMeta:  Queue + Cursor für den optionalen LAN-Sync
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
- `household` / `setHousehold(config)` — Personen + Zieltage für den Krisen-Rechner (localStorage-persistent)

Beim App-Start: `getInitialPage()` prüft sessionStorage auf Form-Draft (Kamera-Reload-Fix).

## Wichtige Patterns

- **Form-Draft-Persist**: ProductForm speichert State in sessionStorage bevor Kamera öffnet (Mobile-PWA wird aus RAM entladen). Store startet auf 'add' wenn Draft existiert.
- **MHD-OCR**: ProductForm-Button „Datum scannen" → Foto → `recognizeExpiryDate` (lazy `tesseract.js`, Assets aus `public/tesseract/`, offline) → erkanntes Datum wird vorausgefüllt (Assistent, nicht Autorität).
- **Krisenfestigkeit**: `computePreparedness` (rein lokal) liefert Score, Wasser-Reichweite (BBK: 2 L/Person/Tag) und Basis-Abdeckung; `computeShoppingList` aus Unterbestand + Wasser-Defizit.
- **Version**: Wird aus `package.json` importiert, erscheint in Settings + JSON-Export. Patch-Bump automatisch via CI bei Merge auf `main`.
- **Export**: JSON ohne Fotos (Platzhalter `[FOTO]`), CSV mit BOM für Umlaute.
- **Import**: Duplikat-Erkennung (Name + MHD + Lagerort). `ImportResult` Klasse für Teil-Erfolg.
- **BarcodeScanner**: Lazy-loaded (`React.lazy`). Nutzt `@zxing/browser`, sucht Rückkamera. Duplikat-Popup wenn Barcode schon existiert. Online: Open Food Facts API Lookup.
- **Notifications**: Lokal via `Notification` API. Checker läuft alle 6h. 30/14/7/3/1 Tage vor MHD.
- **Dark Mode**: CSS-Klasse auf `<html>`, localStorage-persistent, Default: dark.

## Build & Deploy

- Vite base: `./` lokal, `/Prepper_Log/` für GitHub Pages (`GITHUB_PAGES` env var)
- PWA: `vite-plugin-pwa` mit autoUpdate, Workbox; präcacht auch `public/tesseract/` (OCR) und Fonts
- CI/CD: `deploy.yml` (Test + Auto-Patch-Bump + Deploy), `e2e.yml` (Playwright), `lighthouse.yml` (LHCI)
- Fonts: **self-hosted** via `@fontsource` (Inter/Bebas Neue/JetBrains Mono, Latin-Subset), Import in `main.tsx` — kein CDN
- Tailwind: Custom primary/olive/khaki Palette
- CSP (in `index.html`): erlaubt `'wasm-unsafe-eval'` + `worker-src blob:` für die OCR-WASM

## Stilregeln

- Alle UI-Texte auf Deutsch mit korrekten Umlauten (ä, ö, ü, ß)
- Tailwind-Klassen, keine separaten CSS-Dateien (außer globals in index.css)
- Lucide React Icons, keine anderen Icon-Libraries
- `noUnusedLocals: true` in tsconfig — unbenutzte Imports/Variablen = Build-Fehler
- Semikolon-frei bei Tailwind-Klassen, Standard TypeScript-Formatting
