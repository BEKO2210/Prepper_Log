import { useState, useEffect } from 'react';

const DARK_MODE_KEY = 'preptrack-dark-mode';

export function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem(DARK_MODE_KEY);
    if (stored !== null) return stored === 'true';
    return true; // Default: dark
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(DARK_MODE_KEY, String(isDark));
  }, [isDark]);

  const toggle = () => setIsDark((prev) => !prev);

  return [isDark, toggle];
}
