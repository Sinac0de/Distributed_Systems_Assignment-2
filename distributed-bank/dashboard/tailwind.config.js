/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#05070b',
        surface: '#0a0e14',
        line: 'rgba(255,255,255,0.07)',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        panel: '0 24px 70px -40px rgba(0,0,0,0.95)',
        emerald: '0 0 24px -6px rgba(52,211,153,0.45)',
        amber: '0 0 24px -6px rgba(251,191,36,0.4)',
        rose: '0 0 24px -6px rgba(251,113,133,0.4)',
      },
      backgroundImage: {
        'grid-fine':
          'linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
}
