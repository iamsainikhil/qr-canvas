'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const getStoredTheme = (): Theme => {
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Keep server and initial client render deterministic to avoid hydration mismatches.
  const [theme, setTheme] = useState<Theme>('light');
  const [resolved, setResolved] = useState(false);

  // Read the persisted/preferred theme once, after the first render. Marking
  // the theme as resolved prevents the apply effect from writing the default
  // 'light' value over the stored theme before it has been read.
  useEffect(() => {
    setTheme(getStoredTheme());
    setResolved(true);
  }, []);

  // Apply theme on mount and when it changes.
  useEffect(() => {
    if (!resolved) return;

    const html = document.documentElement;
    html.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme, resolved]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

// Initialize theme on page load (before React renders).
export function initializeTheme() {
  if (typeof window === 'undefined') return;

  const stored = localStorage.getItem('theme');
  const theme = stored === 'light' || stored === 'dark'
    ? stored
    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  document.documentElement.classList.toggle('dark', theme === 'dark');
}
