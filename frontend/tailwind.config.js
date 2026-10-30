/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // A warm-gold-on-ink palette with real contrast (WCAG AA for body text).
        forge: {
          black: '#070810',
          dark: '#0c0e16',
          card: '#12151f',
          raised: '#191d2a',
          border: '#252a3a',
          muted: '#a9b1c4', // was #888888 - now readable on dark
          dim: '#7c8398',
          accent: '#e8b464', // brighter gold
          gold: '#f7cd87',
          cream: '#fdf8ef',
          text: '#eef1f8',
        },
        mint: '#4ade9c',
        sky: '#6fa8ff',
        violet: '#a78bfa',
        coral: '#ff7a90',
        amber: '#fbbf24',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.72rem', { lineHeight: '1.1rem' }],
        '3xs': ['0.68rem', { lineHeight: '1rem' }],
      },
      animation: {
        'fade-in': 'fadeIn 0.7s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) forwards',
        'fade-in-down': 'fadeInDown 0.6s ease-out forwards',
        'slide-left': 'slideLeft 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
        float: 'float 7s ease-in-out infinite',
        marquee: 'marquee 38s linear infinite',
        'marquee-slow': 'marquee 60s linear infinite',
        'glow-drift': 'glowDrift 18s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        'spin-slow': 'spin 2.4s linear infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(28px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideLeft: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(50px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        glowDrift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(3%, -4%, 0) scale(1.08)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      transitionTimingFunction: {
        luxury: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      letterSpacing: {
        'ultra-wide': '0.25em',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(232,180,100,0.18), 0 24px 60px -24px rgba(232,180,100,0.35)',
        lift: '0 30px 70px -40px rgba(0,0,0,0.9)',
      },
    },
  },
  plugins: [],
};
