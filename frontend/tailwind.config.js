/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          light: '#f1f5f9',
          DEFAULT: '#0f172a',
          blue: '#2563eb',
        }
      }
    },
  },
  plugins: [],
}
