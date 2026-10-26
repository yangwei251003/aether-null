import { ARTIFACTS } from './artifacts'
import { AUDIO_CONFIG } from './audio'
import { CAMERA_PATHS } from './camera'
import {
  ACTS,
  ACT_BY_ID,
  MAIN_ACTS,
  SITE_METADATA,
  SYSTEM_NAVIGATION,
  SYSTEM_COPY,
} from './content'
import {
  CONSTELLATION_NODES,
  CONSTELLATION_PATHS,
} from './constellation'
import { FEATURE_FLAGS } from './features'
import { MOBILE_FALLBACK, QUALITY_PROFILES } from './quality'
import { PORTAL_CONFIG } from './portal'
import { SIGNAL_LAB } from './signal-lab'
import { AETHER_THEME, CHAPTER_THEMES, THEME_SCENE_COLORS, THEME_VARIANTS } from './theme'

export { ARTIFACTS, ARTIFACT_BY_ID } from './artifacts'
export { AUDIO_CONFIG } from './audio'
export { CAMERA_PATHS, getCameraPath } from './camera'
export {
  ACTS,
  ACT_BY_ID,
  MAIN_ACTS,
  SITE_METADATA,
  SYSTEM_NAVIGATION,
  SYSTEM_COPY,
} from './content'
export {
  CONSTELLATION_CONNECTIONS,
  CONSTELLATION_NODES,
  CONSTELLATION_PATHS,
  MAJOR_CONSTELLATION_NODES,
} from './constellation'
export { FEATURE_FLAGS } from './features'
export {
  MOBILE_FALLBACK,
  QUALITY_PROFILES,
  getQualityProfile,
  recommendQuality,
} from './quality'
export { PORTAL_CONFIG } from './portal'
export { SIGNAL_LAB } from './signal-lab'
export {
  AETHER_THEME,
  CHAPTER_THEMES,
  THEME_SCENE_COLORS,
  THEME_VARIANTS,
  themeToCssVariables,
} from './theme'

/** Stable, component-facing aggregate for future wholesale theme/content replacement. */
export const experienceConfig = {
  site: SITE_METADATA,
  acts: ACTS,
  mainActs: MAIN_ACTS,
  actById: ACT_BY_ID,
  systemCopy: SYSTEM_COPY,
  navigation: SYSTEM_NAVIGATION,
  artifacts: ARTIFACTS,
  constellation: {
    nodes: CONSTELLATION_NODES,
    connections: CONSTELLATION_PATHS,
  },
  signalLab: SIGNAL_LAB,
  portal: PORTAL_CONFIG,
  features: FEATURE_FLAGS,
} as const

export const themeConfig = AETHER_THEME
export const chapterThemes = CHAPTER_THEMES
export const themeVariants = THEME_VARIANTS
export const themeSceneColors = THEME_SCENE_COLORS
export const qualityProfiles = QUALITY_PROFILES
export const mobileFallback = MOBILE_FALLBACK
export const artifacts = ARTIFACTS
export const constellationNodes = CONSTELLATION_NODES
export const constellationConnections = CONSTELLATION_PATHS
export const cameraPath = CAMERA_PATHS
export const audioConfig = AUDIO_CONFIG
export const featureFlags = FEATURE_FLAGS
export const portalConfig = PORTAL_CONFIG
