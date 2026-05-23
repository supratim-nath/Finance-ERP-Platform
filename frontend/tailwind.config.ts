import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#090D16',
        cardDark: '#0D1322',
        borderDark: '#1B253B',
        accentPurple: '#C084FC',
        accentGreen: '#34D399',
        accentRed: '#F87171',
        accentOrange: '#FB923C',
        accentPink: '#F472B6',
        accentYellow: '#FBBF24',
        accentCyan: '#22D3EE',
        accentBlue: '#60A5FA',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      fontSize: {
        '4xs': ['0.5rem', { lineHeight: '0.75rem' }],
        '3xs': ['0.6rem', { lineHeight: '0.9rem' }],
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        glowPurple: '0 0 20px -3px rgba(192, 132, 252, 0.45)',
        glowGreen: '0 0 20px -3px rgba(52, 211, 153, 0.45)',
        glowRed: '0 0 20px -3px rgba(248, 113, 113, 0.45)',
        glowOrange: '0 0 20px -3px rgba(251, 146, 60, 0.45)',
        glowCyan: '0 0 20px -3px rgba(34, 211, 238, 0.45)',
        glowBlue: '0 0 20px -3px rgba(96, 165, 250, 0.45)',
        glowPink: '0 0 20px -3px rgba(244, 114, 182, 0.45)',
        glowYellow: '0 0 20px -3px rgba(251, 191, 36, 0.45)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fadeIn': 'fadeIn 0.35s ease-out both',
        'slideUp': 'slideUp 0.4s ease-out both',
        'slideRight': 'slideRight 0.4s ease-out both',
        'scaleIn': 'scaleIn 0.3s ease-out both',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
