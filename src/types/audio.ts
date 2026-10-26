import type { MainActId } from './experience'

export type AudioBusId = 'ambient' | 'interface' | 'impact' | 'signal'

export type AudioCueId =
  | 'enter-impact'
  | 'core-pulse'
  | 'artifact-open'
  | 'parameter-tick'
  | 'signal-locked'
  | 'node-focus'
  | 'portal-charge'
  | 'portal-cross'

export interface AudioBusConfig {
  readonly id: AudioBusId
  readonly gain: number
  readonly lowpassHz: number
}

export interface SynthCueConfig {
  readonly id: AudioCueId
  readonly bus: AudioBusId
  readonly waveform: OscillatorType
  readonly frequency: number
  readonly frequencyEnd?: number
  readonly detune?: number
  readonly attack: number
  readonly decay: number
  readonly duration: number
  readonly gain: number
  readonly filterHz: number
  readonly noiseMix?: number
}

export interface SceneAudioConfig {
  readonly act: MainActId
  readonly droneFrequency: number
  readonly harmonicRatio: number
  readonly noiseAmount: number
  readonly filterHz: number
  readonly gain: number
  readonly transitionSeconds: number
}

export interface AudioSystemConfig {
  readonly masterGain: number
  readonly fadeInSeconds: number
  readonly analyserFftSize: 256 | 512 | 1024 | 2048
  readonly analyserSmoothing: number
  readonly compressor: Readonly<{
    threshold: number
    knee: number
    ratio: number
    attack: number
    release: number
  }>
  readonly buses: readonly AudioBusConfig[]
  readonly cues: readonly SynthCueConfig[]
  readonly scenes: readonly SceneAudioConfig[]
}

