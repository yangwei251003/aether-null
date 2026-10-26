import type { AccentColor, ActId } from './experience'

export type HexColor = `#${string}`

export interface ThemePalette {
  readonly obsidian: HexColor
  readonly void: HexColor
  readonly graphite: HexColor
  readonly chrome: HexColor
  readonly cyan: HexColor
  readonly magenta: HexColor
  readonly amber: HexColor
  readonly pearl: HexColor
  readonly muted: HexColor
  readonly danger: HexColor
}

export interface TypographyTokens {
  readonly display: string
  readonly body: string
  readonly mono: string
  readonly trackingDisplay: string
  readonly trackingData: string
}

export interface MotionTokens {
  readonly instant: number
  readonly fast: number
  readonly medium: number
  readonly slow: number
  readonly cinematic: number
  readonly easeOut: string
  readonly easeInOut: string
  readonly easeHeavy: string
}

export interface ThemeTokens {
  readonly id: string
  readonly palette: ThemePalette
  readonly typography: TypographyTokens
  readonly motion: MotionTokens
  readonly radius: Readonly<{
    hairline: string
    control: string
    panel: string
    portal: string
  }>
}

export interface ChapterTheme {
  readonly primary: AccentColor
  readonly secondary: AccentColor
  readonly background: HexColor
  readonly fog: HexColor
  readonly lightIntensity: number
  readonly bloomTint: HexColor
}

export type ChapterThemeMap = Readonly<Record<ActId, ChapterTheme>>

