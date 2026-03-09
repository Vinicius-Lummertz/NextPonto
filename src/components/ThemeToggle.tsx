'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const THEME_KEY = 'nextponto-theme';
type Theme = 'light' | 'dark';

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    applyTheme(nextTheme);
    localStorage.setItem(THEME_KEY, nextTheme);
  };

  return (
    <button
      aria-label="Alternar tema"
      title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
      onClick={toggleTheme}
      className="fixed right-5 top-5 z-[60] flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-zinc-900 to-zinc-700 text-amber-300 shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-all duration-300 hover:scale-105 hover:shadow-[0_12px_30px_rgba(0,0,0,0.35)] active:scale-95 dark:border-zinc-700 dark:from-zinc-100 dark:to-zinc-300 dark:text-zinc-700"
    >
      <span className="relative block h-6 w-6">
        <Sun
          className={`absolute inset-0 transition-all duration-300 ${
            theme === 'dark' ? 'scale-0 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'
          }`}
          size={22}
        />
        <Moon
          className={`absolute inset-0 transition-all duration-300 ${
            theme === 'dark' ? 'scale-100 rotate-0 opacity-100' : 'scale-0 -rotate-90 opacity-0'
          }`}
          size={22}
        />
      </span>
    </button>
  );
}
