export const colors = {
  background: '#101827',
  surface: '#1E293B',
  surfaceRaised: '#273449',
  border: '#334155',
  primary: '#F97316',
  primarySoft: '#FB923C',
  primaryMuted: 'rgba(249, 115, 22, 0.16)',
  text: '#FFFFFF',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  success: '#22C55E',
  successMuted: 'rgba(34, 197, 94, 0.18)',
  failure: '#64748B',
  failureMuted: 'rgba(100, 116, 139, 0.25)',
  joker: '#38BDF8',
  jokerMuted: 'rgba(56, 189, 248, 0.18)',
  danger: '#F87171',
  overlay: 'rgba(16, 24, 39, 0.85)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

/** Taille minimale des zones tactiles (Android 48 dp, iOS 44 pt). */
export const MIN_TOUCH = 48;

export const typography = {
  hero: { fontSize: 34, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  heading: { fontSize: 19, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, lineHeight: 23, color: colors.textSecondary },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: '600', color: colors.text },
  caption: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
} as const;
