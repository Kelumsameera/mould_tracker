export type Theme = 'light' | 'dark';
export const THEME_KEY = 'mould-tracker-theme';
export function resolveTheme(saved: string | null, prefersDark: boolean): Theme {
  return saved === 'light' || saved === 'dark' ? saved : prefersDark ? 'dark' : 'light';
}
