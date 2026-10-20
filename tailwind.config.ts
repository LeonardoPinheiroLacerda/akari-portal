import type { Config } from 'tailwindcss'

const v = (name: string) => `var(--${name})`

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        panel: v('panel'),
        raised: v('raised'),
        line: v('line'),
        text: v('text'),
        muted: v('muted'),
        'side-hover': v('side-hover'),
        'logo-bg': v('logo-bg'),
        hover: v('hover'),
        code: v('code'),
        accent: v('accent'),
        'accent-ink': v('accent-ink'),
        'accent-text': v('accent-text'),
        tint: v('tint'),
        danger: v('danger'),
        overlay: v('overlay'),
      },
      fontFamily: {
        sans: ['Sora', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '1.3'],
        xs: ['11px', '1.35'],
        sm: ['12px', '1.4'],
        '13': ['13px', '1.45'],
        base: ['14px', '1.5'],
        '15': ['15px', '1.4'],
        '17': ['17px', '1.3'],
        lg: ['18px', '1.3'],
        xl: ['22px', '1.25'],
        '2xl': ['24px', '1.2'],
        '3xl': ['28px', '1.15'],
        stat: ['30px', '1.1'],
      },
      borderRadius: {
        r: '14px',
        rs: '10px',
        rxs: '6px',
        chip: '999px',
      },
      boxShadow: {
        modal: '0 20px 60px rgba(0,0,0,.35)',
      },
      maxWidth: {
        content: '1280px',
      },
      keyframes: {
        pulse: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
        flash: { from: { backgroundColor: 'var(--tint-strong)' }, to: { backgroundColor: 'transparent' } },
      },
      animation: {
        'pulse-dot': 'pulse 1.6s ease-in-out infinite',
        flash: 'flash 6s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config
