import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // IshVenom design system tokens — backed by CSS variables defined in
        // app/globals.css so they switch between light and dark mode.
        'ish-bg':               'var(--ish-bg)',
        'ish-surface':          'var(--ish-surface)',
        'ish-surface-hover':    'var(--ish-surface-hover)',
        'ish-border':           'var(--ish-border)',
        'ish-text':             'var(--ish-text)',
        'ish-text-secondary':   'var(--ish-text-secondary)',
        'ish-text-muted':       'var(--ish-text-muted)',
        'ish-accent':           'var(--ish-accent)',
        'ish-accent-hover':     'var(--ish-accent-hover)',
        'ish-accent-secondary': 'var(--ish-accent-secondary)',
        'ish-danger':           'var(--ish-danger)',
        'ish-danger-surface':   'var(--ish-danger-surface)',
        'ish-warning':          'var(--ish-warning)',
        'ish-warning-surface':  'var(--ish-warning-surface)',
        'ish-success':          'var(--ish-success)',
        'ish-success-surface':  'var(--ish-success-surface)',
      },
    },
  },
  plugins: [],
};
export default config;
