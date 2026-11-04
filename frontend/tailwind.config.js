// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand: calm evergreen. `primary` is used across the existing forms.
        primary: {
          50: '#f2f6ec',
          100: '#e1ebd4',
          200: '#c5d8ad',
          300: '#a3c081',
          400: '#85a866',
          500: '#6c914c',
          600: '#587d3e',
          700: '#47652f',
          800: '#354b23',
          900: '#243318',
        },
        // Deep ink for the sidebar and headline text.
        ink: {
          DEFAULT: '#1f2b18',
          800: '#26341e',
          700: '#2f4024',
          600: '#3b4f2d',
        },
        // Colors from the Zenty logo.
        sand: '#eadcbf',
        cream: '#edead1',
        bark: '#624f2d',
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
        paper: '#f6f2e6',
        line: '#e6dcc6',
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
        card: '0 1px 2px rgba(31,43,24,0.04), 0 4px 16px -8px rgba(31,43,24,0.08)',
        lift: '0 12px 32px -12px rgba(31,43,24,0.25)',
      },
    },
  },
  plugins: [],
}
