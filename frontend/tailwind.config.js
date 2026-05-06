/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Syne'", 'system-ui', 'sans-serif'],
        mono: ["'IBM Plex Mono'", 'monospace'],
      },
      colors: {
        bg: '#03070f', card: '#0a1020',
        accent: '#00d4ff', accent2: '#7b61ff', accent3: '#00ff94',
      }
    },
  },
  plugins: [],
}
