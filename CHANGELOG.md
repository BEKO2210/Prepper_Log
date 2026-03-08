# Changelog

Alle wichtigen Änderungen an PrepTrack werden hier dokumentiert.
Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

---

## [1.0.0] - 2026-03-08

### Hinzugefügt
- **Barcode-Scanner** mit Kamera-Erkennung via `@zxing/browser`
- **Open Food Facts API** — automatische Produkterkennung nach Scan
- **Duplikat-Erkennung** beim Scannen (zeigt vorhandene Produkte an)
- **Manuelle Produkterfassung** mit Name, Kategorie, Lagerort, Menge, Einheit, MHD, Foto, Notizen
- **MHD-Tracking** mit farbcodierter Ablaufwarnung (rot/orange/gelb/grün)
- **MHD-Genauigkeit** — Tag, Monat oder Jahr wählbar
- **Dashboard** mit StatRing-Visualisierung, MHD-Verteilung, dringenden Produkten, Kategorieübersicht
- **Produktliste** mit Suche, Filtern (Kategorie, Lagerort, Status), Archiv-Ansicht
- **Lagerort-Verwaltung** — eigene Lagerorte anlegen und löschen
- **Mindestbestand-Warnung** bei Unterschreitung des Zielbestands
- **Verbrauchslog** — Produkte als verbraucht/abgelaufen/beschädigt markieren
- **Lokale Push-Benachrichtigungen** — 30, 14, 7, 3 und 1 Tag vor MHD-Ablauf
- **JSON-Backup-Export** mit Duplikat-Erkennung beim Import
- **CSV-Export** mit BOM für korrekte Umlaute in Excel/Google Sheets
- **PWA-Installation** — als App auf Smartphone und Desktop installierbar
- **Offline-first** — vollständig offline nutzbar (IndexedDB + Service Worker)
- **Dark Mode** als Standard, Light Mode umschaltbar
- **PWA-Update-Erkennung** — automatische Aktualisierung bei neuem Deploy
- **Datenschutzerklärung** und **AGB** direkt in der App
- **PayPal-Spenden-Button** in den Einstellungen

### Geändert
- Version wird jetzt automatisch aus `package.json` gelesen (modular)
- Foto-Daten werden beim JSON-Export entfernt (kleinere Dateien)
- Import erkennt Duplikate (Name + MHD + Lagerort) und überspringt sie
- Import-Status zeigt importierte und übersprungene Produkte an

### Entfernt
- Excel-Export (XML-basiert, funktionierte nicht zuverlässig)
- Kamera-Button im Produktformular (temporär deaktiviert, Code bleibt erhalten)

### Behoben
- Formular-State ging verloren wenn native Kamera die PWA aus dem RAM verdrängte
- Alle fehlenden Umlaute in der gesamten App korrigiert (ä, ö, ü, ß)
- PWA-Icons in allen Größen für korrekte Installation
- Service Worker cached jetzt Fonts und API-Responses
- Build-Fehler durch zu große Icons im Workbox-Precache behoben

---

## Projektstatistiken

```
Quellcode .................. 3.778 Zeilen
Quelldateien ............... 23 Dateien
Commits .................... 17
Build-Größe ................ 1,2 MB
  davon JS (minified) ...... 856 KB
  davon CSS (minified) ..... 27 KB
Dependencies (Runtime) ..... 8
Dependencies (Dev) ......... 12
```

---

## Entwicklung

Dieses Projekt wurde mit Unterstützung von **Claude Code (Anthropic)** entwickelt.
Der gesamte Code wurde durch gezielte Anweisungen und iteratives Debugging erstellt —
kein Copy-Paste, kein blindes Generieren. Jede Funktion wurde getestet, jeder Bug
wurde analysiert und systematisch behoben.
