/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F5F6FE',
          100: '#EFF0F6',
          150: '#E9EBF3',
          200: '#D6DBE6',
          300: '#BFC4CF',
          350: '#EAF3FF',
          400: '#DAE9FF',
          500: '#1063E2',
          600: '#0B56C6',
          900: '#313845',
        },
        accent: {
          darkPurple: '#AB9FF2',
          purple: '#C9C0FF',
          lightPurple: '#F4EEFF',
          orange: '#DEB27F',
          green: '#55CBA6',
          blue: '#DAE9FD',
          lightBlue: '#E7F4FD',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
