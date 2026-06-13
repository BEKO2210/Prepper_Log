// Generates the social share / Open Graph image (1200x630) for PrepTrack.
// Run with: node scripts/generate-og-image.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const W = 1200;
const H = 630;
const ICON = 300;
const ICON_X = 96;
const ICON_Y = (H - ICON) / 2;
const TEXT_X = ICON_X + ICON + 70; // 466

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#15301f"/>
      <stop offset="55%" stop-color="#0f1f17"/>
      <stop offset="100%" stop-color="#0a160f"/>
    </linearGradient>
    <radialGradient id="glow" cx="22%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#22c55e" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#22c55e" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="0" width="${W}" height="10" fill="#22c55e"/>

  <!-- rounded plate behind the icon -->
  <rect x="${ICON_X - 24}" y="${ICON_Y - 24}" width="${ICON + 48}" height="${ICON + 48}" rx="40"
        fill="#0c1a12" stroke="#22c55e" stroke-opacity="0.25" stroke-width="2"/>

  <text x="${TEXT_X}" y="250" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="104" font-weight="bold" fill="#f3f4f6">PrepTrack</text>
  <text x="${TEXT_X}" y="312" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="40" font-weight="bold" fill="#4ade80">Dein Vorrat. Immer im Blick.</text>
  <text x="${TEXT_X}" y="372" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="29" fill="#cbd5e1">Offline-PWA · Barcode-Scanner · MHD-Tracker</text>

  <g font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="24" fill="#86efac">
    <rect x="${TEXT_X}" y="424" width="640" height="2" fill="#22c55e" fill-opacity="0.25"/>
    <text x="${TEXT_X}" y="476">Kostenlos · Ohne Konto · 100 % offline · Open Source</text>
  </g>

  <text x="${TEXT_X}" y="540" font-family="DejaVu Sans Mono, monospace" font-size="22" fill="#6b7280">beko2210.github.io/Prepper_Log</text>
</svg>
`;

const icon = await sharp(join(root, 'public/icons/icon-512x512.png'))
  .resize(ICON, ICON, { fit: 'cover' })
  .png()
  .toBuffer();

await sharp(Buffer.from(svg))
  .composite([{ input: icon, left: ICON_X, top: Math.round(ICON_Y) }])
  .png()
  .toFile(join(root, 'public/og-image.png'));

console.log('public/og-image.png (1200x630) erzeugt.');
