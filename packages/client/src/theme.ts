// Casino design tokens. Mirrors CSS variables in index.css.
// Use these for inline-style values where Tailwind classes don't suffice.

export const colors = {
  felt: { 900: '#04150e', 800: '#07261a', 700: '#0a3624', 600: '#0d4630', 500: '#135c3f' },
  gold: {
    300: '#f4d774',
    400: '#e6c258',
    500: '#d4af37',
    600: '#b8902a',
    700: '#8b6914',
    900: '#4a3608',
  },
  ivory: { 50: '#faf3dd', 100: '#f5ead0', 200: '#ebe0c4', 300: '#d8c89c' },
  burgundy: { 500: '#8b2121', 700: '#5b1818', 900: '#2a0a0a' },
  ink: { 900: '#0d0a05', 800: '#1a1308', 700: '#261a0c' },
} as const;

export const gradients = {
  gold: 'linear-gradient(135deg, #f4d774 0%, #d4af37 45%, #8b6914 100%)',
  goldHover: 'linear-gradient(135deg, #fce28a 0%, #e6c258 45%, #b8902a 100%)',
  goldDark: 'linear-gradient(135deg, #b8902a 0%, #8b6914 50%, #4a3608 100%)',
  felt: 'radial-gradient(ellipse at 50% 0%, #135c3f 0%, #0a3624 38%, #04150e 100%)',
  velvet: 'linear-gradient(180deg, #0a3624 0%, #07261a 70%, #04150e 100%)',
  card: 'linear-gradient(170deg, #faf3dd 0%, #ebe0c4 100%)',
  burgundy: 'linear-gradient(135deg, #8b2121, #2a0a0a)',
  burgundyLight: 'linear-gradient(135deg, #b13030, #5b1818)',
  panel: 'linear-gradient(180deg, rgba(10,54,36,0.7), rgba(7,38,26,0.85))',
} as const;

export const shadows = {
  deep: '0 24px 60px -12px rgba(0,0,0,0.85), 0 8px 20px rgba(0,0,0,0.55)',
  mid: '0 12px 32px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.4)',
  low: '0 4px 14px rgba(0,0,0,0.45)',
  goldGlow: '0 0 26px rgba(212,175,55,0.35)',
  goldGlowLg: '0 0 48px rgba(212,175,55,0.45)',
  goldEdge: 'inset 0 0 0 1px rgba(212,175,55,0.35)',
  engrave: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.45)',
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const fonts = {
  display: "'Cinzel', 'Playfair Display', Georgia, serif",
  body: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const;
