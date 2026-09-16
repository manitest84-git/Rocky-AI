import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'jarvis-cyan': '#00f0ff',
        'jarvis-blue': '#0088ff',
        'jarvis-white': '#e0f7fa',
        'jarvis-dark': '#020813',
        'jarvis-navy': '#050e1a',
        'jarvis-amber': '#ff9100',
        'jarvis-red': '#ff2a44',
      },
      fontFamily: {
        orbitron: ['var(--font-orbitron)', 'sans-serif'],
        shareTechMono: ['var(--font-share-tech-mono)', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin-slow 8s linear infinite',
        'spin-reverse': 'spin-reverse 6s linear infinite',
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'grid-drift': 'grid-drift 20s linear infinite',
        flicker: 'flicker 0.15s infinite',
      },
    },
  },
  plugins: [],
};
export default config;
