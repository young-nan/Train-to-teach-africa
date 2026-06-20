/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: { 0:'#0a0c16',1:'#0d0f1a',2:'#13162a',3:'#1a1d30',4:'#22263c',5:'#2c3149' },
        ink:     { 0:'#ffffff',1:'#eef0f7',2:'#b6bbcf',3:'#7a8099',4:'#4f5469' },
        gold:    { 50:'#fbf3dd',200:'#f1d182',400:'#e5a62a',500:'#c98c1c',600:'#a8720f' },
        teal:    { 400:'#22b8a6' },
        emerald: { 400:'#10b981' },
        rose:    { 400:'#fb7185' },
        coral:   { 400:'#f97066' },
        green:   { 400:'#3fb950' },
        amber:   { 400:'#f5a524' },
        sky:     { 400:'#3b82f6' },
        violet:  { 400:'#7c3aed' },
      },
      fontFamily: {
        sans:    ['Inter','system-ui','sans-serif'],
        heading: ['"Plus Jakarta Sans"','Inter','system-ui','sans-serif'],
        display: ['"Crimson Text"','Georgia','serif'],
        mono:    ['"JetBrains Mono"','ui-monospace','monospace'],
      },
      borderRadius: {
        xl:'12px', '2xl':'16px', '3xl':'24px',
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.16,1,0.3,1)',
      },
      keyframes: {
        shimmer: { '0%':{ backgroundPosition:'-200% 0' }, '100%':{ backgroundPosition:'200% 0' } },
        'fade-up': { '0%':{ opacity:0, transform:'translateY(8px)' }, '100%':{ opacity:1, transform:'translateY(0)' } },
      },
      animation: {
        shimmer:  'shimmer 1.8s linear infinite',
        'fade-up':'fade-up 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
