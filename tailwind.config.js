/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: '#FDFBF6',
          100: '#FAF7F2',
          200: '#F2ECE0',
          300: '#E6DCC8',
          400: '#D4C5A4',
        },
        ink: {
          900: '#1F1A12',
          800: '#2C2519',
          700: '#3D3527',
          600: '#574C39',
          500: '#7A6B53',
          400: '#9B8C72',
          300: '#BFAF95',
        },
        domain: {
          language: '#3B5A7A',
          math: '#8C4A3E',
          philosophy: '#5C4F7A',
          physics: '#1F3D5A',
          chemistry: '#7A5C2E',
          life: '#3F5E3C',
          medicine: '#7A2E3A',
          earth: '#4E6B5A',
          social: '#8A6B3E',
          cs: '#2E5C5C',
          engineering: '#5A4632',
        },
        sepia: {
          line: '#C9B79C',
          rule: '#9C8866',
        },
      },
      fontFamily: {
        serif: ['"EB Garamond"', '"Source Serif Pro"', 'Georgia', 'serif'],
        sans: ['Inter', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(60,40,20,0.08), 0 8px 24px rgba(60,40,20,0.12)',
        page: '0 1px 2px rgba(60,40,20,0.06)',
      },
    },
  },
  plugins: [],
};
