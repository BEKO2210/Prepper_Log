<p align="center">
  <img src="public/icons/icon-192x192.png" width="96" height="96" alt="PrepTrack Logo" />
</p>

<h1 align="center">PrepTrack</h1>

<p align="center">
  <strong>Dein Vorrat. Immer im Blick.</strong>
</p>

<p align="center">
  Offline-first Progressive Web App für Prepper, Selbstversorger und alle,<br>
  die ihren Vorrat im Griff haben wollen.
</p>

<p align="center">
  <a href="https://beko2210.github.io/Prepper_Log/">Live Demo</a>
</p>

---

## Was ist PrepTrack?

PrepTrack ist eine kostenlose, werbefreie PWA zur Verwaltung von Vorräten.
Produkte scannen, Mindesthaltbarkeitsdaten tracken, Benachrichtigungen erhalten —
alles offline, alles lokal auf deinem Gerät.

---

## Features

```
SCANNER            Barcode scannen, automatische Produkterkennung
                   via Open Food Facts API. Duplikat-Warnung wenn
                   Produkt bereits vorhanden.

ERFASSUNG          Name, Kategorie, Lagerort, Menge, Einheit,
                   MHD (Tag/Monat/Jahr), Foto, Mindestbestand,
                   Notizen.

MHD-TRACKING       Farbcodierte Ablaufwarnung:
                   Rot = abgelaufen/kritisch (≤7 Tage)
                   Orange = Warnung (≤14 Tage)
                   Gelb = bald fällig (≤30 Tage)
                   Grün = alles gut

DASHBOARD          Übersicht mit StatRing-Visualisierung,
                   MHD-Verteilungsbalken, dringende Produkte,
                   Kategorieübersicht, Unterbestand-Zähler.

BENACHRICHTIGUNGEN Lokale Push-Erinnerungen 30, 14, 7, 3 und
                   1 Tag vor Ablauf. Keine externen Server.

LAGERORTE          Eigene Lagerorte anlegen und verwalten.
                   Standard: Keller, Garage, Küche, Dachboden,
                   Vorratsraum, Bunker, Auto, Gartenhaus.

VERBRAUCHSLOG      Produkte als verbraucht, abgelaufen oder
                   beschädigt markieren. Statistiken einsehen.

DATEN-EXPORT       JSON-Backup (vollständig, ohne Fotos für
                   kleine Dateigröße) und CSV-Export mit
                   korrekten Umlauten für Excel/Google Sheets.

DATEN-IMPORT       Backup wiederherstellen mit automatischer
                   Duplikat-Erkennung. Keine doppelten Einträge.

OFFLINE-FIRST      Vollständig offline nutzbar. Alle Daten in
                   IndexedDB. Service Worker cached Assets,
                   Fonts und API-Responses.

INSTALLIERBAR      Als PWA auf Android, iOS und Desktop
                   installierbar. Fühlt sich an wie native App.

DARK MODE          Dunkles Design als Standard.
                   Helles Design umschaltbar.
```

---

## Tech Stack

```
Kategorie        Technologie                 Zweck
─────────────────────────────────────────────────────────────────
Framework        React 18 + TypeScript       Interaktive SPA, Typsicherheit
Bundler          Vite 6                      Schneller Dev-Server, optimaler Build
Styling          Tailwind CSS 3              Utility-first, Dark Mode Support
State            Zustand                     Leichtgewichtig, kein Boilerplate
Datenbank        Dexie.js (IndexedDB)        Offline-first, reaktive Queries
PWA              vite-plugin-pwa (Workbox)   Auto-Update, Runtime Caching
Scanner          @zxing/browser              Barcode/EAN-Erkennung via Kamera
Icons            Lucide React                Konsistente, leichte SVG Icons
Animation        Framer Motion               Smooth UI-Transitions
API              Open Food Facts             Kostenlose Produktdatenbank
CI/CD            GitHub Actions              Auto-Deploy auf GitHub Pages
```

---

## Projektstatistiken

```
Quellcode ........................ 3.778 Zeilen
Quelldateien ..................... 23 TypeScript/TSX
Commits .......................... 17
Build-Größe (gesamt) ............. 1,2 MB
  davon JS (minified) ........... 856 KB
  davon CSS (minified) .......... 27 KB
Runtime Dependencies ............. 8
Dev Dependencies ................. 12
Test-Framework ................... Vitest
Tests ............................ 15 (alle bestanden)
Lighthouse PWA Score ............. 100
```

---

## Setup & Installation

```bash
# Repository klonen
git clone https://github.com/BEKO2210/Prepper_Log.git
cd Prepper_Log

# Dependencies installieren
npm install

# Entwicklungsserver starten
npm run dev
```

Die App ist dann unter `http://localhost:5173` verfügbar.

### Build

```bash
npm run build      # Production Build
npm run preview    # Build lokal testen
npm run test       # Tests ausführen
```

---

## Deploy (GitHub Pages)

1. Repository auf GitHub pushen
2. Unter **Settings > Pages** die Source auf **GitHub Actions** setzen
3. Bei jedem Push auf `main` wird automatisch deployed

---

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

---

## Datenschutz

```
Datenspeicherung     Alle Daten werden ausschließlich lokal auf
                     deinem Gerät gespeichert (IndexedDB im Browser).
                     Keine Cloud. Keine Server. Keine Accounts.

Tracking             Kein Tracking. Keine Analytics. Keine Cookies.
                     Keine Werbung. Keine Daten an Dritte.

Externe Dienste      Nur beim Barcode-Scan wird die Open Food Facts
                     API kontaktiert (gemeinnütziges Open-Data-Projekt).
                     Dabei wird nur der Barcode übermittelt.

Benachrichtigungen   Werden lokal auf deinem Gerät erzeugt.
                     Keine Push-Tokens an externe Server.

Deine Kontrolle      Vollständiger JSON-Export/-Import.
                     Daten löschen über Browser-Einstellungen.
```

---

## Projektstruktur

```
src/
├── components/          UI-Komponenten
│   ├── Dashboard.tsx        Hauptübersicht mit Stats
│   ├── ProductList.tsx      Produktliste mit Filtern
│   ├── ProductForm.tsx      Formular (Hinzufügen/Bearbeiten)
│   ├── BarcodeScanner.tsx   Barcode-Scanner mit Kamera
│   ├── Settings.tsx         Einstellungen, Export/Import
│   ├── Statistics.tsx       Verbrauchsstatistiken
│   ├── Navigation.tsx       Bottom Navigation Bar
│   ├── StatRing.tsx         Kreisdiagramm-Komponente
│   └── PWAInstallPrompt.tsx PWA-Installationshinweis
├── hooks/               Custom React Hooks
│   ├── useDarkMode.ts       Dark/Light Mode Toggle
│   ├── useOnlineStatus.ts   Online/Offline-Erkennung
│   └── usePWAInstall.ts     PWA-Installation
├── lib/                 Geschäftslogik
│   ├── db.ts                Dexie.js Datenbank, CRUD, Export/Import
│   ├── utils.ts             MHD-Berechnung, Formatierung, Barcode-Lookup
│   ├── utils.test.ts        Unit Tests
│   └── notifications.ts     Lokale Benachrichtigungen
├── store/               State Management
│   └── useAppStore.ts       Zustand Store (Navigation, Filter, State)
├── types/               TypeScript Typen
│   └── index.ts             Product, Category, Units, etc.
├── App.tsx              Hauptkomponente
├── main.tsx             Entry Point
└── sw-handler.ts        Service Worker Update-Handler
```

---

## Entwicklung

Dieses Projekt wurde mit Unterstützung von **Claude Code** (Anthropic, Modell: claude-opus-4-6) entwickelt.

Das bedeutet nicht blindes Copy-Paste oder generierter Spaghetti-Code.
Jede Funktion wurde durch gezielte Anweisungen gesteuert, jeder Bug wurde
analysiert und systematisch behoben, jedes Feature wurde Schritt für Schritt
implementiert und getestet. Der Mensch gibt die Richtung vor, die KI setzt um.

> Siehe [CHANGELOG.md](CHANGELOG.md) für die vollständige Änderungshistorie.

---

## Lizenz

```
Copyright 2025 Belkis Aslani

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

Siehe [LICENSE](LICENSE) für den vollständigen Lizenztext.
