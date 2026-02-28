/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0a0e27',
          800: '#1a1f3a',
          700: '#2d3561',
          600: '#4a5584',
        },
        gold: {
          500: '#fbbf24',
          400: '#f59e0b',
          300: '#fcd34d',
        }
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-gold': 'pulse-gold 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'pulse-gold': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        }
      }
    },
  },
  plugins: [],
}
