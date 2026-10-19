import type { Config } from 'tailwindcss'

// Cores dos cardápios impressos do Bom Paladar: preto, dourado e um vermelho quente.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0b0b0c', 900: '#131315', 800: '#1c1c1f', 700: '#2a2a2e', 600: '#4a4a50' },
        gold: { 200: '#f3e2b3', 300: '#ecd08a', 400: '#e0b85a', 500: '#c99a3b', 600: '#a87c27' },
        ember: { 400: '#ef4a3f', 500: '#d62f2a', 600: '#b3241f' },
        cream: { 50: '#fbf8f1', 100: '#f4eee1', 200: '#e8dfcb' },
        basil: { 500: '#3f7d3a', 600: '#2f6229' },
        muted: '#5c5852',
      },
      fontFamily: {
        display: ['Oswald', 'Arial Narrow', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
