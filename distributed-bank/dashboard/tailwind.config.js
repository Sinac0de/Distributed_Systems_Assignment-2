import colors from 'tailwindcss/colors.js'

/**
 * Map a Tailwind palette onto RGB CSS variables so the same utility classes
 * (text-slate-500, bg-emerald-400/10, ...) can be re-themed at runtime.
 * The fallback keeps the original palette for the default dark theme.
 */
function rgbTriplet(hex) {
  const value = Number.parseInt(hex.slice(1), 16)
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`
}

function themedPalette(name) {
  return Object.fromEntries(
    Object.entries(colors[name]).map(([shade, hex]) => [
      shade,
      `rgb(var(--${name}-${shade}, ${rgbTriplet(hex)}) / <alpha-value>)`,
    ]),
  )
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--ink, 5 7 11) / <alpha-value>)',
        surface: 'rgb(var(--surface, 10 14 20) / <alpha-value>)',
        elevated: 'rgb(var(--elevated, 11 17 23) / <alpha-value>)',
        line: 'rgb(var(--line, 255 255 255) / <alpha-value>)',
        white: 'rgb(var(--white, 255 255 255) / <alpha-value>)',
        black: 'rgb(var(--black, 0 0 0) / <alpha-value>)',
        slate: themedPalette('slate'),
        emerald: themedPalette('emerald'),
        cyan: themedPalette('cyan'),
        amber: themedPalette('amber'),
        rose: themedPalette('rose'),
        violet: themedPalette('violet'),
        blue: themedPalette('blue'),
        teal: themedPalette('teal'),
        orange: themedPalette('orange'),
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
