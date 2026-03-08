const sharp = require('sharp');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
const SOURCE = '/tmp/original-icon.png';

const sizes = [
  { name: 'icon-48x48.png', size: 48 },
  { name: 'icon-72x72.png', size: 72 },
  { name: 'icon-96x96.png', size: 96 },
  { name: 'icon-128x128.png', size: 128 },
  { name: 'icon-144x144.png', size: 144 },
  { name: 'icon-152x152.png', size: 152 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-384x384.png', size: 384 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

async function generate() {
  for (const { name, size } of sizes) {
    await sharp(SOURCE)
      .resize(size, size, { fit: 'cover' })
      .png({ quality: 90 })
      .toFile(path.join(ICONS_DIR, name));
    console.log(`Generated ${name}`);
  }

  // Maskable icon with 20% safe zone padding (white bg)
  const maskSize = 512;
  const innerSize = Math.round(maskSize * 0.8);
  const offset = Math.round((maskSize - innerSize) / 2);
  const inner = await sharp(SOURCE).resize(innerSize, innerSize).png().toBuffer();

  await sharp({
    create: { width: maskSize, height: maskSize, channels: 4, background: { r: 15, g: 31, b: 23, alpha: 1 } }
  })
    .composite([{ input: inner, left: offset, top: offset }])
    .png()
    .toFile(path.join(ICONS_DIR, 'maskable-icon.png'));
  console.log('Generated maskable-icon.png');

  // Favicon 32x32
  await sharp(SOURCE)
    .resize(32, 32)
    .png()
    .toFile(path.join(ICONS_DIR, '..', 'favicon.png'));
  console.log('Generated favicon.png');
}

generate().catch(console.error);
