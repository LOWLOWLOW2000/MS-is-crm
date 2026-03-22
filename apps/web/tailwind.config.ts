import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        recallFlash: {
          '0%, 100%': { backgroundColor: 'rgb(254 249 195 / 0.8)' },
          '50%': { backgroundColor: 'rgb(253 224 71 / 0.9)' },
        },
      },
      animation: {
        ticker: 'ticker 25s linear infinite',
        slideInLeft: 'slideInLeft 0.25s ease-out',
        'recall-flash': 'recallFlash 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
