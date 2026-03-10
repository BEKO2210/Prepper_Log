# Contributing to PrepTrack

First off, thank you for considering contributing to PrepTrack! Every contribution helps make the app better for everyone.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Style Guidelines](#style-guidelines)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project adheres to the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

- Use the [Bug Report](https://github.com/BEKO2210/Prepper_Log/issues/new?template=bug_report.yml) issue template
- Include screenshots if possible
- Mention your device, browser, and whether the app is installed as PWA

### Suggesting Features

- Use the [Feature Request](https://github.com/BEKO2210/Prepper_Log/issues/new?template=feature_request.yml) issue template
- Explain the problem your feature solves
- Include mockups if applicable

### Code Contributions

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Ensure all checks pass
5. Submit a pull request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Prepper_Log.git
cd Prepper_Log

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Type check
npx tsc --noEmit

# Production build
npm run build
```

## Project Architecture

PrepTrack is an offline-first PWA built with:

- **React 18 + TypeScript** — UI framework
- **Vite 6** — Build tool
- **Tailwind CSS 3** — Styling
- **Zustand** — State management (routing via `useAppStore.currentPage`, NOT React Router)
- **Dexie.js** — IndexedDB wrapper for local data storage
- **react-i18next** — Internationalization (German default, English)

### Key Patterns

- **Routing:** Handled by Zustand store (`currentPage`), not React Router
- **i18n:** Components use `useTranslation()` hook; non-React files use `i18n` singleton import
- **Form Drafts:** ProductForm persists state to `sessionStorage` (prevents data loss on mobile PWA reload)
- **Lazy Loading:** BarcodeScanner, Settings, and Statistics are lazy-loaded with `React.lazy()`

### Database (Dexie.js / IndexedDB)

```
products:             ++id, name, barcode, category, storageLocation, expiryDate, archived, createdAt
storageLocations:     ++id, name
consumptionLogs:      ++id, productId, consumedAt
notificationSchedules: ++id, productId, notifyAt, sent, [productId+daysBefore]
```

## Style Guidelines

### Code Style

- TypeScript with strict mode
- No semicolons in Tailwind classes
- `noUnusedLocals: true` — unused imports/variables cause build errors
- Tailwind CSS classes only (no separate CSS files except `index.css`)
- Lucide React icons only (no other icon libraries)

### UI Text

- All user-facing text must use i18n translation keys
- German (`de`) is the default language
- When adding new text, add keys to both `src/i18n/locales/de/translation.json` and `src/i18n/locales/en/translation.json`
- Use correct German umlauts (ä, ö, ü, ß)

### Components

- Functional components with hooks
- Named exports (not default exports) for components
- Props interfaces defined inline or in `types/index.ts`

## Commit Messages

Use conventional commit format:

```
feat: add barcode history view
fix: correct expiry date calculation for month precision
docs: update README with new screenshots
refactor: extract StatRing into separate component
test: add tests for formatDaysUntil edge cases
chore: update dependencies
```

## Pull Request Process

1. Ensure your branch is up to date with `main`
2. Run all checks:
   ```bash
   npx tsc --noEmit    # No type errors
   npm run test         # All tests pass
   npm run build        # Build succeeds
   ```
3. Fill out the PR template completely
4. Link related issues
5. Wait for review — maintainers may request changes

### What We Look For

- Clean, readable code
- No unnecessary complexity
- Translation keys for all new UI text (DE + EN)
- No security vulnerabilities (XSS, injection, etc.)
- Proper offline support (no assumptions about network availability)
- Dark mode compatibility

---

Thank you for contributing! 🎉
