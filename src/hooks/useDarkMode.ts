import { useEffect, useState } from 'react';

const DARK_MODE_KEY = 'preptrack-dark-mode';

function readStoredTheme(): boolean {
  try {
    const stored = localStorage.getItem(DARK_MODE_KEY);
    if (stored === 'true' || stored === 'false') return stored === 'true';
    // Fallback falls das Init-Script in index.html nicht laufen konnte:
    // OS-Präferenz folgen, Default Dark.
    const prefersLight =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: light)').matches;
    const isDark = !prefersLight;
    try {
      localStorage.setItem(DARK_MODE_KEY, String(isDark));
    } catch {
      // ignore
    }
    return isDark;
  } catch {
    return true;
  }
}

function applyTheme(isDark: boolean) {
  const root = document.documentElement;
  if (isDark) root.classList.add('dark');
  else root.classList.remove('dark');
  try {
    localStorage.setItem(DARK_MODE_KEY, String(isDark));
  } catch {
    // ignore
  }
}

export function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = useState<boolean>(readStoredTheme);

  // Anderen Tabs/Fenstern folgen, damit die Einstellung über alle Instanzen
  // hinweg synchron bleibt.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === DARK_MODE_KEY && (e.newValue === 'true' || e.newValue === 'false')) {
        setIsDark(e.newValue === 'true');
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // DOM-Klasse + localStorage synchron halten.
  useEffect(() => {
    applyTheme(isDark);
  }, [isDark]);

  const toggle = () => setIsDark((prev) => !prev);

  return [isDark, toggle];
}
