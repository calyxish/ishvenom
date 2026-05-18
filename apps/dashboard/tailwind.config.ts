import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // IshVenom design system tokens — dark mode
        'ish-bg':               '#080C12',
        'ish-surface':          '#0F172A',
        'ish-surface-hover':    '#1E293B',
        'ish-border':           '#1E293B',
        'ish-text':             '#F0F9FF',
        'ish-text-secondary':   '#94A3B8',
        'ish-text-muted':       '#64748B',
        'ish-accent':           '#0EA5E9',
        'ish-accent-hover':     '#0284C7',
        'ish-accent-secondary': '#7DD3FC',
        'ish-danger':           '#EF4444',
        'ish-danger-surface':   '#2D1214',
        'ish-warning':          '#F59E0B',
        'ish-warning-surface':  '#2D2206',
        'ish-success':          '#10B981',
        'ish-success-surface':  '#0D2818',
      },
    },
  },
  plugins: [],
};
export default config;
