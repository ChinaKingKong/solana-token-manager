/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'solana-green': '#14F195',
        'solana-purple': '#9945FF',
        'dark-bg': '#0B132B',
        'dark-bg-light': '#1A2235',
      },
      backgroundImage: {
        'gradient-solana': 'linear-gradient(135deg, #14F195 0%, #9945FF 100%)',
        'gradient-dark': 'linear-gradient(180deg, #0B132B 0%, #1A2235 100%)',
      },
      transitionDuration: {
        '400': '400ms',
      },
    },
  },
  plugins: [],
}

