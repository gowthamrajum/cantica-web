/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Fraunces = warm, high-contrast serif for display; Anek Telugu carries
        // bilingual (Telugu + English) body copy.
        serif: ['Fraunces', 'Georgia', 'Cambria', 'serif'],
        sans: ['"Anek Telugu"', 'Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        // Warm paper backgrounds
        paper: '#faf6ee',
        panel: '#f3ece0',
        card: '#fffdf9',
        // Deep, trustworthy navy — the primary
        navy: {
          50: '#eef1f7', 100: '#d6dcea', 200: '#aab5d0', 300: '#7d8db2',
          400: '#4f6493', 500: '#2f4676', 600: '#22345c',
          700: '#1b2947', 800: '#151f38', 900: '#0f1728'
        },
        // Candle-gold accent
        gold: {
          50: '#fbf5e7', 100: '#f4e6c4', 200: '#e8cd8c', 300: '#dcb457',
          400: '#cc9d3c', 500: '#b8893f', 600: '#9a6f2e', 700: '#795626'
        },
        ink: { DEFAULT: '#241f18', soft: '#4c453a', muted: '#8b8172' },
        line: '#e8ddc9'
      },
      boxShadow: {
        soft: '0 1px 2px rgba(36,31,24,.04), 0 8px 24px -12px rgba(36,31,24,.14)',
        lift: '0 2px 4px rgba(36,31,24,.05), 0 24px 48px -20px rgba(36,31,24,.22)',
        gold: '0 10px 30px -12px rgba(184,137,63,.45)'
      },
      letterSpacing: { label: '.18em' },
      borderRadius: { xl2: '1.25rem' }
    }
  },
  plugins: []
}
