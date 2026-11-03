// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand: calm evergreen. `primary` is used across the existing forms.
        primary: {
          50: '#eef7f3',
          100: '#d5ece2',
          200: '#acd8c5',
          300: '#7bbea3',
          400: '#4c9f81',
          500: '#2f8468',
          600: '#226d55',
          700: '#1c5845',
          800: '#173f33',
          900: '#0f2a22',
        },
        // Deep ink for the sidebar and headline text.
        ink: {
          DEFAULT: '#0f231d',
          800: '#16302a',
          700: '#1e3d35',
          600: '#2b4c43',
        },
        // Fresh matcha accent: glows on the dark evergreen, used for highlights.
        matcha: {
          50: '#f5fbe6',
          100: '#e7f5c4',
          200: '#d9efa2',
          300: '#cdec85',
          400: '#b6df55',
          500: '#93c234',
          600: '#6c9420',
          700: '#4f6e15',
        },
        // Warm saffron: the money accent (coins, amounts, highlights).
        saffron: {
          50: '#fff8e8',
          100: '#fdecc4',
          200: '#fbdc93',
          300: '#f7c95e',
          400: '#f2b33d',
          500: '#e09b1f',
          600: '#b97c12',
          700: '#8f5f0d',
        },
        // Lilac: the insight accent (investments, assistant, tips).
        lilac: {
          50: '#f6f3fd',
          100: '#ece6fb',
          200: '#d9cdf6',
          300: '#bfaaf0',
          400: '#a185e6',
          500: '#8564d6',
          600: '#6b4bb8',
          700: '#543a93',
        },
        paper: '#f6f3ec',
        line: '#e8e2d5',
        // Warm neutrals replace cool gray everywhere.
        gray: {
          50: '#faf9f6',
          100: '#f3f1ec',
          200: '#e8e4dc',
          300: '#d6d1c6',
          400: '#a8a197',
          500: '#7a746b',
          600: '#5c574f',
          700: '#45413b',
          800: '#2e2b27',
          900: '#1d1b18',
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Fraunces Variable"', 'ui-serif', 'Georgia', 'serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,35,29,0.04), 0 4px 16px -8px rgba(15,35,29,0.08)',
        lift: '0 12px 32px -12px rgba(15,35,29,0.25)',
      },
    },
  },
  plugins: [],
}
