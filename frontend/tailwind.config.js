/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Identidad corporativa Marketing Total: verde institucional.
        brand: {
          light: '#eef2ef',
          DEFAULT: '#1f3d2b',   // verde profundo (sidebar, encabezados)
          blue: '#2e6b4f',      // acento (enlaces, bordes activos)
          50: '#f4f8f5',
          100: '#e3ede6',
          200: '#c7dccf',
          300: '#9cc1aa',
          400: '#679f80',
          500: '#45805f',
          600: '#35674b',
          700: '#2a533d',
          800: '#234533',
          900: '#16302a',
        }
      },
    },
  },
  plugins: [],
}
