'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { resolveTheme, THEME_KEY, type Theme } from '@/lib/theme';
import type { Dict } from '@/lib/i18n';
import Icon from './Icon';

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'light', toggle: () => {} });

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0B1318' : '#1B2B35');
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem(THEME_KEY); } catch { /* device storage unavailable */ }
      const next = resolveTheme(saved, media.matches);
      applyTheme(next); setTheme(next);
    };
    sync();
    media.addEventListener('change', sync);
    window.addEventListener('storage', sync);
    return () => { media.removeEventListener('change', sync); window.removeEventListener('storage', sync); };
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch { /* still switch for this visit */ }
    applyTheme(next); setTheme(next);
  };
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle({ t }: { t: Dict }) {
  const { theme, toggle } = useContext(ThemeContext);
  const label = theme === 'dark' ? t.themeLight : t.themeDark;
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label} aria-pressed={theme === 'dark'}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} /></button>;
}
