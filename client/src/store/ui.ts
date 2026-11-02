import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

function readTheme(): Theme {
  try { return (localStorage.getItem('cmi.theme') as Theme) || 'system'; } catch { return 'system'; }
}

function readBool(key: string, fallback: boolean): boolean {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v === '1'; } catch { return fallback; }
}

interface UiState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileNavOpen: boolean;
  setMobileNav: (open: boolean) => void;
  paletteOpen: boolean;
  setPalette: (open: boolean) => void;
}

export const useUi = create<UiState>((set, get) => ({
  theme: readTheme(),
  setTheme: (theme) => {
    try { localStorage.setItem('cmi.theme', theme); } catch { /* ignore */ }
    applyTheme(theme);
    set({ theme });
  },
  sidebarCollapsed: readBool('cmi.sidebar', false),
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    try { localStorage.setItem('cmi.sidebar', next ? '1' : '0'); } catch { /* ignore */ }
    set({ sidebarCollapsed: next });
  },
  mobileNavOpen: false,
  setMobileNav: (open) => set({ mobileNavOpen: open }),
  paletteOpen: false,
  setPalette: (open) => set({ paletteOpen: open }),
}));

applyTheme(readTheme());
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(useUi.getState().theme));

export function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}
