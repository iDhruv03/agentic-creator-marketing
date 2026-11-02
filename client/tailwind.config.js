/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.5rem' },
    extend: {
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        surface: {
          DEFAULT: 'hsl(var(--surface) / <alpha-value>)',
          muted: 'hsl(var(--surface-muted) / <alpha-value>)',
          raised: 'hsl(var(--surface-raised) / <alpha-value>)',
        },
        primary: { DEFAULT: 'hsl(var(--primary) / <alpha-value>)', foreground: 'hsl(var(--primary-foreground) / <alpha-value>)', soft: 'hsl(var(--primary-soft) / <alpha-value>)' },
        muted: { DEFAULT: 'hsl(var(--muted) / <alpha-value>)', foreground: 'hsl(var(--muted-foreground) / <alpha-value>)' },
        accent: { DEFAULT: 'hsl(var(--accent) / <alpha-value>)', foreground: 'hsl(var(--accent-foreground) / <alpha-value>)' },
        success: { DEFAULT: 'hsl(var(--success) / <alpha-value>)', soft: 'hsl(var(--success-soft) / <alpha-value>)' },
        warning: { DEFAULT: 'hsl(var(--warning) / <alpha-value>)', soft: 'hsl(var(--warning-soft) / <alpha-value>)' },
        danger: { DEFAULT: 'hsl(var(--danger) / <alpha-value>)', soft: 'hsl(var(--danger-soft) / <alpha-value>)' },
        info: { DEFAULT: 'hsl(var(--info) / <alpha-value>)', soft: 'hsl(var(--info-soft) / <alpha-value>)' },
        agent: { DEFAULT: 'hsl(var(--agent) / <alpha-value>)', soft: 'hsl(var(--agent-soft) / <alpha-value>)' },
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem', '3xl': '1.5rem' },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'], mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'], display: ['"Instrument Sans"', 'Inter', 'sans-serif'] },
      boxShadow: {
        card: '0 1px 2px 0 hsl(var(--shadow) / 0.04), 0 1px 3px 0 hsl(var(--shadow) / 0.06)',
        raised: '0 4px 12px -2px hsl(var(--shadow) / 0.10), 0 2px 4px -1px hsl(var(--shadow) / 0.06)',
        overlay: '0 24px 48px -12px hsl(var(--shadow) / 0.28), 0 8px 16px -8px hsl(var(--shadow) / 0.12)',
        glow: '0 0 0 1px hsl(var(--primary) / 0.25), 0 8px 24px -6px hsl(var(--primary) / 0.35)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.97)' }, to: { opacity: '1', transform: 'scale(1)' } },
        shimmer: { '0%': { backgroundPosition: '-600px 0' }, '100%': { backgroundPosition: '600px 0' } },
        'pulse-ring': { '0%': { transform: 'scale(1)', opacity: '0.8' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'slide-up': 'slide-up 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 160ms cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.6s linear infinite',
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
