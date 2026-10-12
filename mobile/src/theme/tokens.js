/**
 * Design tokens ported from the web app's src/style.css custom properties.
 * Each theme bundles its own radii/shadows because the "contrast" theme
 * overrides both (smaller radii, shadows disabled) in the original CSS.
 */

export const fonts = {
  // Loaded via @expo-google-fonts/* + expo-font's useFonts() in App.js.
  // Matches the web app's current design system: --font-latin/--font-sans/
  // --font-title all 'Atkinson Hyperlegible', --font-khmer 'Suwannaphum'.
  sans: 'AtkinsonHyperlegible_400Regular',
  sansMedium: 'AtkinsonHyperlegible_400Regular',
  sansBold: 'AtkinsonHyperlegible_700Bold',
  khmer: 'Suwannaphum_400Regular',
  khmerBold: 'Suwannaphum_700Bold',
  title: 'AtkinsonHyperlegible_700Bold',
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
}

export const touchTarget = {
  min: 44,
}

export const transitions = {
  fast: 150,
  smooth: 200,
}

const shadow = (color, offsetY, opacity, radius, elevation) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: offsetY },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation,
})

const noShadow = { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 }

// style.css's SURFACES.md token tier (--bg, --surface-1/2, --primary, --divider,
// --navy, --heading...). The web's [data-theme="light"] block only overrides
// the legacy aliases (--bg-surface etc.), so newer components — bottom nav,
// upload zone, sample list, history shelf — still read these :root values.
const lightSurfaces = {
  bg: '#F8FAFC',
  surface1: '#EEF3FB',
  surface2: '#DBE7FF',
  onSurface: '#0F172A',
  onSurfaceMuted: '#334155',
  onTonal: '#1E3A8A',
  primary: '#1D4ED8',
  primaryPressed: '#1E40AF',
  onPrimary: '#FFFFFF',
  divider: '#CBD5E1',
  navy: '#0B1B4D',
  onNavy: '#FFFFFF',
  heading: '#1D4ED8',
}

const darkSurfaces = {
  bg: '#0B1220',
  surface1: '#111B2E',
  surface2: '#1E2A44',
  onSurface: '#E5E7EB',
  onSurfaceMuted: '#CBD5E1',
  onTonal: '#DBEAFE',
  primary: '#93C5FD',
  primaryPressed: '#BFDBFE',
  onPrimary: '#0B1220',
  divider: '#334155',
  navy: '#060E2B',
  onNavy: '#FFFFFF',
  heading: '#93C5FD',
}

const contrastSurfaces = {
  bg: '#000000',
  surface1: '#000000',
  surface2: '#000000',
  onSurface: '#FFFFFF',
  onSurfaceMuted: '#FFFFFF',
  onTonal: '#FFFFFF',
  primary: '#FFFF00',
  primaryPressed: '#FFFF88',
  onPrimary: '#000000',
  divider: '#FFFFFF',
  navy: '#000000',
  onNavy: '#FFFFFF',
  heading: '#FFFF00',
}

const lightBase = {
  bgPage: '#F4F7FC',
  bgSurface: '#FFFFFF',
  bgSurfaceElevated: '#EBF2FA',
  bgSurfaceHover: '#E1ECF8',

  borderSubtle: '#94A3B8',
  borderMedium: '#0052CC',
  borderProminent: '#003D99',
  borderFocus: '#0052CC',

  textPrimary: '#0A1628',
  textSecondary: '#1E293B',
  textMuted: '#475569',
  textInverse: '#FFFFFF',

  accent: '#0052CC',
  accentHover: '#0040A1',
  accentText: '#FFFFFF',
  accentSubtle: 'rgba(0, 82, 204, 0.10)',
  accentGlow: 'rgba(0, 82, 204, 0.22)',

  brand: '#0052CC',
  brandLight: '#0065FF',
  brandSubtle: 'rgba(0, 82, 204, 0.10)',

  success: '#059669',
  successHover: '#047857',
  successSubtle: 'rgba(5, 150, 105, 0.12)',

  danger: '#DC2626',
  dangerSubtle: 'rgba(220, 38, 38, 0.12)',

  surfaces: lightSurfaces,
  radii: { xs: 4, sm: 4, md: 4, lg: 4, xl: 4, full: 4 },
  shadows: {
    sm: shadow('#0C1A30', 2, 0.06, 6, 2),
    md: shadow('#0C1A30', 6, 0.10, 20, 6),
    lg: shadow('#0C1A30', 12, 0.14, 36, 12),
    glow: shadow('#0052CC', 0, 0.25, 24, 0),
  },
}

// style.css [data-theme="dark"] — SURFACES.md tonal surfaces, and container
// borders inherit :root's `transparent` (colour surfaces instead of lines).
const darkBase = {
  bgPage: '#0B1220',
  bgSurface: '#111B2E',
  bgSurfaceElevated: '#1E2A44',
  bgSurfaceHover: '#243254',

  borderSubtle: 'transparent',
  borderMedium: 'transparent',
  borderProminent: '#94A3B8',
  borderFocus: '#FFFFFF',

  textPrimary: '#E5E7EB',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  textInverse: '#0B1220',

  accent: '#93C5FD',
  accentHover: '#BFDBFE',
  accentText: '#0B1220',
  accentSubtle: 'rgba(147, 197, 253, 0.16)',
  accentGlow: 'rgba(147, 197, 253, 0.30)',

  brand: '#93C5FD',
  brandLight: '#93C5FD',
  brandSubtle: 'rgba(147, 197, 253, 0.16)',

  success: '#6EE7B7',
  successHover: '#34D399',
  successSubtle: 'rgba(110, 231, 183, 0.15)',

  danger: '#FCA5A5',
  dangerSubtle: 'rgba(252, 165, 165, 0.15)',

  surfaces: darkSurfaces,
  radii: { xs: 4, sm: 4, md: 4, lg: 4, xl: 4, full: 4 },
  shadows: {
    sm: shadow('#000000', 1, 0.4, 3, 1),
    md: shadow('#000000', 4, 0.5, 14, 4),
    lg: shadow('#000000', 8, 0.6, 28, 8),
    glow: shadow('#3B82F6', 0, 0.35, 24, 0),
  },
}

const contrastBase = {
  bgPage: '#000000',
  bgSurface: '#000000',
  bgSurfaceElevated: '#111111',
  bgSurfaceHover: '#1E1E1E',

  borderSubtle: '#FFFFFF',
  borderMedium: '#FFFFFF',
  borderProminent: '#FFFFFF',
  borderFocus: '#FFFFFF',

  textPrimary: '#FFFFFF',
  textSecondary: '#FFFFFF',
  textMuted: '#E5E7EB',
  textInverse: '#000000',

  accent: '#FFFF00',
  accentHover: '#FFFFFF',
  accentText: '#000000',
  accentSubtle: 'rgba(255, 255, 0, 0.2)',
  accentGlow: 'rgba(255, 255, 0, 0.6)',

  brand: '#FFFF00',
  brandLight: '#FFFF00',
  brandSubtle: 'rgba(255, 255, 0, 0.2)',

  success: '#00FF00',
  successHover: '#00CC00',
  successSubtle: 'rgba(0, 255, 0, 0.15)',
  danger: '#FF5555',
  dangerSubtle: 'rgba(255, 85, 85, 0.15)',

  surfaces: contrastSurfaces,
  radii: { xs: 4, sm: 4, md: 4, lg: 4, xl: 4, full: 4 },
  shadows: { sm: noShadow, md: noShadow, lg: noShadow, glow: noShadow },
}

export const themes = {
  light: lightBase,
  dark: darkBase,
  contrast: contrastBase,
}

export const themeNames = ['light', 'dark', 'contrast']
