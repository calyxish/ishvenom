import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // IshVenom design system tokens — dark mode
        'ish-bg':               '#0F0D15',
        'ish-surface':          '#1A1725',
        'ish-surface-hover':    '#252236',
        'ish-border':           '#2E2B3A',
        'ish-text':             '#F5F3FF',
        'ish-text-secondary':   '#A8A3B8',
        'ish-text-muted':       '#6B6580',
        'ish-accent':           '#7C5AFF',
        'ish-accent-hover':     '#6B4AE0',
        'ish-accent-secondary': '#A88BFA',
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
