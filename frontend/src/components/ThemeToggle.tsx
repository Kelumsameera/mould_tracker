"use client";
import { useEffect, useState } from "react";
import { resolveTheme, THEME_KEY, type Theme } from "@/utils/helpers";
import type { Dict } from "@/utils/i18n";
import Icon from "@/components/Icon";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#0B1318" : "#1B2B35");
}

export function ThemeToggle({ translations }: { translations: Dict }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(THEME_KEY);
      } catch {
        /* device storage unavailable */
      }
      const next = resolveTheme(saved, media.matches);
      applyTheme(next);
      setTheme(next);
    };
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("storage", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* still switch for this visit */
    }
    applyTheme(next);
    setTheme(next);
  };
  const label = theme === "dark" ? translations.themeLight : translations.themeDark;
  return (
    <button
      type="button"
      className="hover:bg-[rgba(127,127,127,.15)] inline-flex items-center justify-center w-11 h-11 shrink-0 border border-solid border-current rounded-md bg-transparent text-inherit cursor-pointer"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={theme === "dark"}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
    </button>
  );
}
