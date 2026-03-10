# Changelog

All notable changes to PrepTrack are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.2.0] - 2026-03-10

### Added
- **Italian (IT) language** — complete translation for all 222+ keys
- **French (FR) language** — complete translation for all 222+ keys
- **Portuguese (PT) language** — complete translation for all 222+ keys
- **Arabic (AR) RTL layout support** — logical CSS properties (`border-s`, `ps`, `pe`, `ms`, `me`, `start`, `end`) for correct mirroring in RTL mode
- **Automatic product image download** — barcode scan now fetches and compresses product photos from Open Food Facts API
- **Archive delete** — products in the archive view can now be deleted

### Changed
- PrepTrack now supports **6 languages**: German, English, Portuguese, Arabic, Italian, French
- Status color strip on product cards uses dedicated `<div>` element instead of `border-s-{color}` classes (fixes light mode CSS specificity conflict)
- README.md completely rewritten with prominent 6-language showcase, updated features, and optimized screenshot sizes
- CONTRIBUTING.md updated with all 6 supported languages
- CHANGELOG.md updated with project statistics

### Fixed
- **Status color strip invisible in light mode** — `html:not(.dark) .border-primary-700` had higher CSS specificity than `.border-s-{color}`, overriding status colors
- **Lighthouse accessibility: color contrast** — StatRing labels (`text-gray-500` to `text-gray-400`), navigation inactive labels (`text-gray-400` to `text-gray-300`)
- **Lighthouse accessibility: heading order** — PWAInstallPrompt `<h3>` changed to `<p>` (no parent `<h2>` existed)

### Removed
- `REVIEW_REPORT.md` — internal code review document (not needed for public repo)
- `code-review/` directory — internal review artifacts
- `public/icons/Icon_3117x3117_8MB.png` — 7.3 MB source icon (CI/CD already removed it before deploy)

---

## [1.1.0] - 2026-03-09

### Added
- **Internationalization (i18n)** — Full multi-language support using react-i18next
- **German (DE)**, **English (EN)**, **Portuguese (PT)**, and **Arabic (AR)** translations for all UI text
- **Language switcher** in Settings with country flag icons and language codes
- **Browser language detection** — automatically selects the user's preferred language
- **Language persistence** via localStorage (`preptrack-language`)
- **GitHub Issue Templates** — Bug Report, Feature Request, Question (YAML forms)
- **Pull Request Template** with checklist
- **CONTRIBUTING.md** — Contribution guidelines for developers
- **SECURITY.md** — Security policy and vulnerability reporting
- **CODE_OF_CONDUCT.md** — Contributor Covenant Code of Conduct
- **Professional README.md** — Bilingual (EN/DE), badges, star chart, screenshots

### Changed
- All components now use `useTranslation()` hook for text rendering
- `utils.ts` functions (`formatDaysUntil`, `formatDuration`, `getStatusLabel`) use i18n
- `notifications.ts` notification titles and bodies are now localized
- `db.ts` CSV export headers, import messages, and error messages are localized
- `ErrorBoundary.tsx` uses i18n singleton (class component pattern)
- Tests updated with `beforeAll(() => i18n.changeLanguage('de'))` for correct locale
- README completely rewritten with screenshots, badges, star chart, bilingual structure

---

## [1.0.1] - 2026-03-09

### Fixed
- **Lighthouse Performance** score improved (lazy loading Settings + Statistics)
- **Lighthouse Accessibility** — heading hierarchy fixed (single h1, h2 for pages, h3 for sections)
- **Color contrast** — text-gray-500 upgraded to text-gray-400 for WCAG compliance
- **Font loading** — added `&display=swap` to Google Fonts for better CLS
- **Viewport** — removed `maximum-scale=1.0, user-scalable=no` for accessibility

### Added
- **Impressum** (Legal Notice) — TMG-compliant with full address and contact
- **Datenschutzerklaerung** (Privacy Policy) — local data, external services, rights
- **AGB** (Terms and Conditions) — scope, liability, donations
- **SEO improvements** — extended title, meta description, canonical link
- **sitemap.xml** and updated **robots.txt**

---

## [1.0.0] - 2026-03-08

### Added
- **Barcode Scanner** with camera recognition via `@zxing/browser`
- **Open Food Facts API** — automatic product recognition after scan
- **Duplicate detection** when scanning (shows existing products)
- **Manual product entry** with name, category, location, quantity, unit, expiry, photo, notes
- **Expiry tracking** with color-coded warnings (red/orange/yellow/green)
- **Expiry precision** — day, month, or year selectable
- **Dashboard** with StatRing visualization, expiry distribution, urgent products, categories
- **Product list** with search, filters (category, location, status), archive view
- **Storage location management** — create and delete custom locations
- **Minimum stock warning** when below target stock
- **Consumption log** — mark products as consumed/expired/damaged
- **Local push notifications** — 30, 14, 7, 3, and 1 day before expiry
- **JSON backup export** with duplicate detection on import
- **CSV export** with BOM for correct umlauts in Excel/Google Sheets
- **PWA installation** — installable as app on smartphone and desktop
- **Offline-first** — fully usable offline (IndexedDB + Service Worker)
- **Dark Mode** as default, Light Mode togglable
- **PWA update detection** — automatic update on new deploy
- **Privacy Policy** and **Terms** directly in the app
- **PayPal donation button** in settings

### Changed
- Version is now automatically read from `package.json`
- Photo data is stripped from JSON export (smaller file sizes)
- Import detects duplicates (name + expiry + location) and skips them
- Import status shows imported and skipped product counts

### Removed
- Excel export (XML-based, unreliable)
- Camera button in product form (temporarily disabled, code preserved)

### Fixed
- Form state was lost when native camera displaced PWA from RAM
- All missing umlauts corrected throughout the entire app
- PWA icons in all sizes for correct installation
- Service Worker now caches fonts and API responses
- Build errors from oversized icons in Workbox precache

---

## Project Statistics

```
Source Code .................. ~5,000 lines
Source Files ................. 26 TypeScript/TSX
Translation Files ............ 6 (de, en, pt, ar, it, fr)
Translation Keys ............. 222+ per language
Build Size (total) ........... ~1.3 MB
  JS (minified) .............. ~560 KB (main) + ~420 KB (scanner, lazy)
  CSS (minified) ............. ~28 KB
Runtime Dependencies ......... 12
Dev Dependencies ............. 14
Test Framework ............... Vitest
Tests ........................ 59 (all passing)
Languages .................... DE, EN, PT, AR (RTL), IT, FR
Lighthouse PWA Score ......... 100
```

---

## Development

This project was developed with the assistance of **Claude Code** (Anthropic, Model: claude-opus-4-6).
Every function was controlled through targeted instructions, every bug was analyzed and systematically
fixed, every feature was implemented and tested step by step.
