export interface ParsedExpiry {
  date: string; // ISO date (YYYY-MM-DD), local
  precision: 'day' | 'month' | 'year';
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, mär: 3, apr: 4, may: 5, mai: 5, jun: 6, jul: 7,
  aug: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dez: 12,
};

function clampMonth(m: number): number | null {
  return m >= 1 && m <= 12 ? m : null;
}

function fullYear(y: number): number {
  if (y >= 1000) return y;
  // Expiry dates are always in the (recent) future, so a 2-digit year maps to
  // the 2000s — never the 1900s.
  if (y < 100) return 2000 + y;
  return y;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function iso(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Extracts an expiry date from free-form (OCR) text. Tolerant of surrounding
 * noise like "MHD", "best before", lot codes. Returns null if nothing usable.
 */
export function parseExpiryDate(raw: string): ParsedExpiry | null {
  if (!raw) return null;
  const text = raw.toLowerCase();
  const sep = '[.\\/\\-\\s]';

  // 1) ISO: YYYY-MM-DD
  let m = text.match(/\b(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\b/);
  if (m) {
    const y = +m[1];
    const mo = clampMonth(+m[2]);
    const d = +m[3];
    if (mo && d >= 1 && d <= lastDayOfMonth(y, mo)) return { date: iso(y, mo, d), precision: 'day' };
  }

  // 2) DD.MM.YYYY / DD.MM.YY
  m = text.match(new RegExp(`\\b(\\d{1,2})${sep}(\\d{1,2})${sep}(\\d{2,4})\\b`));
  if (m) {
    const d = +m[1];
    const mo = clampMonth(+m[2]);
    const y = fullYear(+m[3]);
    if (mo && d >= 1 && d <= lastDayOfMonth(y, mo)) return { date: iso(y, mo, d), precision: 'day' };
  }

  // 3) MM.YYYY / MM/YY (month precision -> last day of month)
  m = text.match(new RegExp(`\\b(\\d{1,2})${sep}(\\d{2,4})\\b`));
  if (m) {
    const mo = clampMonth(+m[1]);
    const y = fullYear(+m[2]);
    if (mo) return { date: iso(y, mo, lastDayOfMonth(y, mo)), precision: 'month' };
  }

  // 4) Named month: "mar 2027", "dez 26", "dez2026"
  m = text.match(/\b([a-zä]{3,})\.?\s*(\d{2,4})\b/);
  if (m) {
    const mo = MONTH_NAMES[m[1].slice(0, 3)];
    if (mo) {
      const y = fullYear(+m[2]);
      return { date: iso(y, mo, lastDayOfMonth(y, mo)), precision: 'month' };
    }
  }

  // 5) Bare year
  m = text.match(/\b(20\d{2})\b/);
  if (m) {
    const y = +m[1];
    return { date: iso(y, 12, 31), precision: 'year' };
  }

  return null;
}

/**
 * Runs offline OCR (Tesseract.js, bundled core + eng model from /public/tesseract)
 * on an image and extracts an expiry date. Engine code is lazy-imported so it
 * never weighs on the main bundle. Returns null if no date could be read.
 */
export async function recognizeExpiryDate(image: Blob | File): Promise<ParsedExpiry | null> {
  const { createWorker, PSM } = await import('tesseract.js');
  const base = import.meta.env.BASE_URL || '/';

  const worker = await createWorker('eng', 1, {
    workerPath: `${base}tesseract/worker.min.js`,
    corePath: `${base}tesseract/tesseract-core-simd-lstm.wasm.js`,
    langPath: `${base}tesseract/`,
    gzip: true,
  });

  try {
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789.:/- ',
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });
    // Guard against a hung worker so the "Datum scannen" button can never get
    // stuck on the running state.
    const { data } = await Promise.race([
      worker.recognize(image),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OCR timeout')), 20_000)
      ),
    ]);
    return parseExpiryDate(data.text);
  } finally {
    await worker.terminate();
  }
}
