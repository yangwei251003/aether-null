import type { ChapterThemeMap, ThemeTokens, ThemeVariant } from '../types'

export const AETHER_THEME = {
  id: 'aether-null',
  palette: {
    obsidian: '#030407',
    void: '#080A0F',
    graphite: '#11151D',
    chrome: '#A9B6BD',
    cyan: '#62F1FF',
    magenta: '#FA61C3',
    amber: '#FFB14A',
    pearl: '#EDF5F4',
    muted: '#8F9CA3',
    danger: '#FF575F',
  },
  typography: {
    display: '"Archivo Variable", "Arial Narrow", sans-serif',
    body: '"Manrope Variable", Arial, sans-serif',
    mono: '"IBM Plex Mono", "Roboto Mono", monospace',
    trackingDisplay: '-0.055em',
    trackingData: '0.14em',
  },
  motion: {
    instant: 0.14,
    fast: 0.28,
    medium: 0.62,
    slow: 1.15,
    cinematic: 2.4,
    easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    easeHeavy: 'cubic-bezier(0.22, 0.72, 0.12, 1)',
  },
  radius: {
    hairline: '1px',
    control: '0.25rem',
    panel: '1rem',
    portal: '999px',
  },
} as const satisfies ThemeTokens

export const CHAPTER_THEMES = {
  boot: {
    primary: 'cyan',
    secondary: 'chrome',
    background: '#030507',
    fog: '#071016',
    lightIntensity: 0.55,
    bloomTint: '#35F2FF',
  },
  awakening: {
    primary: 'cyan',
    secondary: 'magenta',
    background: '#040509',
    fog: '#07101B',
    lightIntensity: 1.15,
    bloomTint: '#51F6FF',
  },
  descent: {
    primary: 'magenta',
    secondary: 'cyan',
    background: '#07030C',
    fog: '#160624',
    lightIntensity: 0.92,
    bloomTint: '#FF3FBD',
  },
  artifacts: {
    primary: 'amber',
    secondary: 'pearl',
    background: '#080705',
    fog: '#17120B',
    lightIntensity: 0.78,
    bloomTint: '#FFB547',
  },
  'signal-lab': {
    primary: 'cyan',
    secondary: 'magenta',
    background: '#03080A',
    fog: '#06161A',
    lightIntensity: 1.02,
    bloomTint: '#35F2FF',
  },
  'memory-ocean': {
    primary: 'pearl',
    secondary: 'cyan',
    background: '#05080B',
    fog: '#0C1D28',
    lightIntensity: 0.62,
    bloomTint: '#C8F9FF',
  },
  constellation: {
    primary: 'cyan',
    secondary: 'amber',
    background: '#030407',
    fog: '#080B14',
    lightIntensity: 0.84,
    bloomTint: '#76F7FF',
  },
  portal: {
    primary: 'amber',
    secondary: 'pearl',
    background: '#060504',
    fog: '#171006',
    lightIntensity: 1.32,
    bloomTint: '#FFD182',
  },
  'specimen-lab': {
    primary: 'magenta',
    secondary: 'cyan',
    background: '#070509',
    fog: '#160A1A',
    lightIntensity: 0.95,
    bloomTint: '#FF5BC8',
  },
} as const satisfies ChapterThemeMap

export const THEME_VARIANTS = {
  aether: { primary: '#35F2FF', secondary: '#FF3FBD', highlight: '#F3F6F8' },
  solar: { primary: '#FFB547', secondary: '#FF6B47', highlight: '#FFF1D7' },
  null: { primary: '#AAB5C2', secondary: '#555F6D', highlight: '#E1E6EC' },
  pearl: { primary: '#F3F6F8', secondary: '#88DCE5', highlight: '#FFFFFF' },
} as const satisfies Readonly<
  Record<ThemeVariant, { primary: `#${string}`; secondary: `#${string}`; highlight: `#${string}` }>
>

export const THEME_SCENE_COLORS = {
  aether: [THEME_VARIANTS.aether.primary, THEME_VARIANTS.aether.secondary, THEME_VARIANTS.aether.highlight],
  solar: [THEME_VARIANTS.solar.primary, THEME_VARIANTS.solar.secondary, THEME_VARIANTS.solar.highlight],
  null: [THEME_VARIANTS.null.primary, THEME_VARIANTS.null.secondary, THEME_VARIANTS.null.highlight],
  pearl: [THEME_VARIANTS.pearl.primary, THEME_VARIANTS.pearl.secondary, THEME_VARIANTS.pearl.highlight],
} as const satisfies Readonly<Record<ThemeVariant, readonly [`#${string}`, `#${string}`, `#${string}`]>>

export function themeToCssVariables(theme: ThemeTokens = AETHER_THEME): Record<string, string> {
  return {
    '--color-obsidian': theme.palette.obsidian,
    '--color-void': theme.palette.void,
    '--color-graphite': theme.palette.graphite,
    '--color-chrome': theme.palette.chrome,
    '--color-cyan': theme.palette.cyan,
    '--color-magenta': theme.palette.magenta,
    '--color-amber': theme.palette.amber,
    '--color-pearl': theme.palette.pearl,
    '--color-muted': theme.palette.muted,
    '--font-display': theme.typography.display,
    '--font-body': theme.typography.body,
    '--font-mono': theme.typography.mono,
    '--ease-signal': theme.motion.easeOut,
    '--ease-heavy': theme.motion.easeHeavy,
  }
}
