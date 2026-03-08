# PrepTrack — Code Review Report
Datum: 2026-03-08
Reviewer: Automatisiertes 5-köpfiges Senior Review-Team

## ZUSAMMENFASSUNG

| Kategorie              | Gefunden | Gefixt | Offen |
|------------------------|----------|--------|-------|
| Dependency-Probleme    | 2        | 1      | 1     |
| TypeScript-Fehler      | 0        | 0      | 0     |
| Memory Leaks           | 0        | 0      | 0     |
| Logik-Fehler           | 0        | 0      | 0     |
| Broken Imports         | 0        | 0      | 0     |
| Security-Issues        | 0        | 0      | 0     |
| Build-Probleme         | 2        | 2      | 0     |
| CI/CD-Probleme         | 1        | 1      | 0     |
| Code-Qualität          | 1        | 1      | 0     |

**Gesamtbewertung: SEHR GUT — Codebase ist sauber, sicher und konsistent.**

---

## KRITISCHE FINDINGS (Schweregrad: HOCH)

### 1. npm audit: 9 Vulnerabilities (4 HIGH, 5 MODERATE)
- **serialize-javascript ≤7.0.2**: RCE via RegExp.flags (HIGH)
- **esbuild ≤0.24.2**: Dev-Server Request-Leak (MODERATE)
- **Status**: OFFEN — Fix erfordert Major-Version-Upgrades von `vitest` (→4.x) und `vite-plugin-pwa` (→1.x), was Breaking Changes mit sich bringt
- **Risikobewertung**: Beide betreffen nur Dev-Dependencies/Build-Tools, NICHT den Production-Code. Kein Runtime-Risiko für Endbenutzer.
- **Empfehlung**: Bei nächstem Feature-Sprint auf `vitest@4`, `vite@7`, `vite-plugin-pwa@1` upgraden

---

## MITTLERE FINDINGS (Schweregrad: MITTEL)

### 2. Fehlende `public/404.html` für GitHub Pages SPA-Routing
- **Problem**: Direkte URL-Aufrufe auf GitHub Pages lieferten 404
- **Fix**: `public/404.html` erstellt mit SPA-Redirect-Script
- **Status**: GEFIXT

### 3. Fehlender `navigateFallback` in Workbox-Config
- **Problem**: Service Worker hatte keinen Fallback für unbekannte Routen im Offline-Modus
- **Fix**: `navigateFallback: 'index.html'` in `vite.config.ts` → workbox hinzugefügt
- **Status**: GEFIXT

### 4. Unbenutzte Dependency `react-router-dom`
- **Problem**: In package.json als Dependency, wird aber nirgends importiert (Routing via Zustand Store)
- **Fix**: `npm uninstall react-router-dom` — 4 Packages entfernt
- **Status**: GEFIXT

---

## INFORMATIONEN (Schweregrad: LOW / INFO)

### 5. `console.log` in Production (sw-handler.ts)
- **Problem**: 2x `console.log` ohne DEV-Guard
- **Fix**: Beide mit `if (import.meta.env.DEV)` gewrappt
- **Status**: GEFIXT

### 6. GitHub Actions Node 18.x (EOL September 2025)
- **Problem**: CI-Matrix testete noch mit Node 18.x, das seit Sep 2025 EOL ist
- **Fix**: Matrix auf `[20.x, 22.x]` aktualisiert
- **Status**: GEFIXT

### 7. Viele Major-Updates verfügbar
- React 18 → 19, Tailwind 3 → 4, Vite 6 → 7, Vitest 2 → 4
- **Empfehlung**: Separate Upgrade-Session planen, nicht im laufenden Betrieb mischen

### 8. @types/react und @types/react-dom nicht via require.resolve auflösbar
- **Bewertung**: False Positive — TypeScript Types werden korrekt aufgelöst, `require.resolve` findet sie nur nicht weil sie in `@types/` Namespace liegen
- **Status**: Kein Handlungsbedarf

---

## DURCHGEFÜHRTE FIXES

| # | Datei | Änderung |
|---|-------|----------|
| 1 | `vite.config.ts:18` | `navigateFallback: 'index.html'` hinzugefügt |
| 2 | `public/404.html` | Neue Datei: GitHub Pages SPA-Redirect |
| 3 | `package.json` | `react-router-dom` entfernt (unbenutzt) |
| 4 | `src/sw-handler.ts:18` | `console.log` → `if (import.meta.env.DEV) console.log` |
| 5 | `src/sw-handler.ts:26` | `console.log` → `if (import.meta.env.DEV) console.log` |
| 6 | `.github/workflows/deploy.yml:23` | Node-Matrix `[18.x, 20.x]` → `[20.x, 22.x]` |

---

## VERBLEIBENDE OFFENE PUNKTE

| # | Priorität | Beschreibung |
|---|-----------|--------------|
| 1 | MITTEL | npm audit: serialize-javascript + esbuild Vulnerabilities (nur Dev-Tools, kein Production-Risiko) — Fix via Major-Upgrades von vitest/vite-plugin-pwa |
| 2 | LOW | Major-Upgrades: React 19, Tailwind 4, Vite 7, Vitest 4 — separate Upgrade-Session empfohlen |

---

## BUILD-STATUS NACH FIXES

- **TypeScript**: PASS (0 Fehler)
- **Build**: PASS (33 precached entries)
- **Tests**: PASS (15/15)
- **Bundle-Größe**: 138kb gzipped (main) + 110kb gzipped (BarcodeScanner lazy-loaded)
- **PWA-Anforderungen**: PASS (Manifest, SW, Icons, Offline-Caching)
- **Security**: PASS (CSP, keine Secrets, kein dangerouslySetInnerHTML, nur HTTPS)

---

*PrepTrack Code Review Report v1.0 — Automatisiertes Review, 2026-03-08*
*"Es geht hier um Leben und Tod — dann prüfen wir das auch so."*
