import { AUDIO_CONFIG } from '../config/audio'
import type { MainActId } from '../types'

type SignalParams = {
  frequency: number
  coherence: number
  entropy: number
}

type AudioCueId = (typeof AUDIO_CONFIG.cues)[number]['id']

class AetherAudioEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private ambient: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private analyser: AnalyserNode | null = null
  private noise: AudioBufferSourceNode | null = null
  private noiseGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private oscillators: OscillatorNode[] = []
  private enabled = false
  private chargeOscillator: OscillatorNode | null = null
  private chargeGain: GainNode | null = null
  private lifecycleAttached = false
  private volume: number = AUDIO_CONFIG.masterGain
  private readonly spectrum = new Uint8Array(AUDIO_CONFIG.analyserFftSize / 2)

  private readonly handleVisibility = () => {
    if (!this.context) return
    if (document.hidden) void this.context.suspend()
    else if (this.enabled) void this.context.resume()
  }

  async unlock(signal?: AbortSignal): Promise<boolean> {
    try {
      if (signal?.aborted) return false
      if (!this.context) this.createGraph()
      if (!this.context) {
        this.enabled = false
        return false
      }
      if (this.context.state === 'suspended') await this.context.resume()
      if (signal?.aborted) return false
      if (this.context.state !== 'running') {
        this.enabled = false
        return false
      }
      this.setEnabled(true)
      return true
    } catch {
      if (!signal?.aborted) this.setEnabled(false)
      return false
    }
  }

  private createGraph() {
    const AudioCtor = window.AudioContext ?? window.webkitAudioContext
    if (!AudioCtor) return
    const ctx = new AudioCtor()
    const master = ctx.createGain()
    const ambient = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    const compressor = ctx.createDynamicsCompressor()
    const analyser = ctx.createAnalyser()
    const ambientBus = AUDIO_CONFIG.buses.find((bus) => bus.id === 'ambient')!
    const bootScene = AUDIO_CONFIG.scenes.find((scene) => scene.act === 'boot')!

    master.gain.value = 0
    ambient.gain.value = ambientBus.gain * 0.2
    filter.type = 'lowpass'
    filter.frequency.value = Math.min(ambientBus.lowpassHz, bootScene.filterHz)
    filter.Q.value = 8
    analyser.fftSize = AUDIO_CONFIG.analyserFftSize
    analyser.smoothingTimeConstant = AUDIO_CONFIG.analyserSmoothing
    compressor.threshold.value = AUDIO_CONFIG.compressor.threshold
    compressor.knee.value = AUDIO_CONFIG.compressor.knee
    compressor.ratio.value = AUDIO_CONFIG.compressor.ratio
    compressor.attack.value = AUDIO_CONFIG.compressor.attack
    compressor.release.value = AUDIO_CONFIG.compressor.release

    ambient.connect(filter)
    filter.connect(analyser)
    analyser.connect(compressor)
    compressor.connect(master)
    master.connect(ctx.destination)

    const frequencies = [
      bootScene.droneFrequency,
      bootScene.droneFrequency * bootScene.harmonicRatio,
      bootScene.droneFrequency * bootScene.harmonicRatio * bootScene.harmonicRatio,
    ]
    frequencies.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = index === 1 ? 'triangle' : 'sine'
      oscillator.frequency.value = frequency
      oscillator.detune.value = index * 6 - 4
      gain.gain.value = [0.34, 0.16, 0.08][index]
      oscillator.connect(gain)
      gain.connect(ambient)
      oscillator.start()
      this.oscillators.push(oscillator)
    })

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const channel = noiseBuffer.getChannelData(0)
    for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    const noiseGain = ctx.createGain()
    noise.buffer = noiseBuffer
    noise.loop = true
    noiseGain.gain.value = bootScene.noiseAmount * 0.14
    noise.connect(noiseGain)
    noiseGain.connect(ambient)
    noise.start()

    this.context = ctx
    this.master = master
    this.ambient = ambient
    this.filter = filter
    this.compressor = compressor
    this.analyser = analyser
    this.noise = noise
    this.noiseGain = noiseGain
    this.noiseBuffer = noiseBuffer
    if (!this.lifecycleAttached) {
      document.addEventListener('visibilitychange', this.handleVisibility)
      this.lifecycleAttached = true
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!this.context || !this.master) return
    const now = this.context.currentTime
    if (!enabled && this.chargeGain) {
      this.chargeGain.gain.cancelScheduledValues(now)
      this.chargeGain.gain.setTargetAtTime(0.0001, now, 0.025)
    }
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setTargetAtTime(
      enabled ? this.volume : 0,
      now,
      enabled ? AUDIO_CONFIG.fadeInSeconds / 3 : 0.08,
    )
  }

  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume))
    if (!this.context || !this.master || !this.enabled) return
    const now = this.context.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setTargetAtTime(this.volume, now, 0.055)
  }

  toggle() {
    if (!this.context) return false
    this.setEnabled(!this.enabled)
    return this.enabled
  }

  isEnabled() {
    return this.enabled
  }

  setScene(act: MainActId) {
    if (!this.context || !this.filter || !this.ambient) return
    const scene = AUDIO_CONFIG.scenes.find((entry) => entry.act === act)
    if (!scene) return
    const now = this.context.currentTime
    const smoothing = Math.max(0.08, scene.transitionSeconds / 3)
    this.filter.frequency.setTargetAtTime(scene.filterHz, now, smoothing)
    this.ambient.gain.setTargetAtTime(scene.gain, now, smoothing)
    this.noiseGain?.gain.setTargetAtTime(scene.noiseAmount * 0.14, now, smoothing)
    this.oscillators.forEach((oscillator, index) => {
      const harmonic = index === 0 ? 1 : Math.pow(scene.harmonicRatio, index)
      oscillator.frequency.setTargetAtTime(scene.droneFrequency * harmonic, now, smoothing)
    })
  }

  setSignalParams({ frequency, coherence, entropy }: SignalParams) {
    if (!this.context || !this.filter || !this.ambient) return
    const now = this.context.currentTime
    this.filter.frequency.setTargetAtTime(180 + frequency * 21, now, 0.08)
    this.filter.Q.setTargetAtTime(2 + coherence * 0.16, now, 0.08)
    this.ambient.gain.setTargetAtTime(0.025 + entropy * 0.0011, now, 0.12)
    this.oscillators.forEach((oscillator, index) => {
      oscillator.detune.setTargetAtTime((entropy - 50) * (index + 1) * 0.8, now, 0.08)
    })
  }

  impact(strength = 1) {
    this.cue('enter-impact', strength)
  }

  cue(id: AudioCueId, strength = 1) {
    if (!this.context || !this.enabled) return
    const cue = AUDIO_CONFIG.cues.find((entry) => entry.id === id)
    if (!cue) return
    const ctx = this.context
    const destination = this.analyser ?? this.master
    if (!destination) return
    const bus = AUDIO_CONFIG.buses.find((entry) => entry.id === cue.bus)
    const start = ctx.currentTime
    const end = start + cue.duration
    const oscillator = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    oscillator.type = cue.waveform
    oscillator.frequency.setValueAtTime(cue.frequency, start)
    oscillator.detune.value = 'detune' in cue ? cue.detune ?? 0 : 0
    if ('frequencyEnd' in cue && cue.frequencyEnd) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, cue.frequencyEnd), end)
    }
    filter.type = 'lowpass'
    filter.frequency.value = cue.filterHz
    filter.Q.value = id === 'signal-locked' ? 5.4 : 1.8
    const peak = cue.gain * (bus?.gain ?? 1) * strength
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + cue.attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, Math.min(end, start + cue.attack + cue.decay))
    oscillator.connect(filter)
    filter.connect(gain)
    gain.connect(destination)
    oscillator.start(start)
    oscillator.stop(end)

    if ('noiseMix' in cue && cue.noiseMix && this.noiseBuffer) {
      const noise = ctx.createBufferSource()
      const noiseFilter = ctx.createBiquadFilter()
      const noiseGain = ctx.createGain()
      noise.buffer = this.noiseBuffer
      noiseFilter.type = 'bandpass'
      noiseFilter.frequency.value = cue.filterHz * 0.72
      noiseFilter.Q.value = 0.72
      noiseGain.gain.setValueAtTime(0.0001, start)
      noiseGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * cue.noiseMix), start + cue.attack)
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, end)
      noise.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(destination)
      noise.start(start)
      noise.stop(end)
      noise.onended = () => {
        noise.disconnect()
        noiseFilter.disconnect()
        noiseGain.disconnect()
      }
    }
    oscillator.onended = () => {
      oscillator.disconnect()
      filter.disconnect()
      gain.disconnect()
    }
  }

  chirp(success = false) {
    if (!this.context || !this.master || !this.enabled) return
    const ctx = this.context
    const notes = success ? [196, 293.66, 440, 659.25] : [164.81, 220]
    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      const start = ctx.currentTime + index * 0.085
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42)
      oscillator.connect(gain)
      gain.connect(this.master!)
      oscillator.start(start)
      oscillator.stop(start + 0.45)
      oscillator.onended = () => {
        oscillator.disconnect()
        gain.disconnect()
      }
    })
  }

  setPortalCharge(charge: number) {
    if (!this.context || !this.master || !this.enabled) return
    if (!this.chargeOscillator || !this.chargeGain) {
      this.chargeOscillator = this.context.createOscillator()
      this.chargeGain = this.context.createGain()
      this.chargeOscillator.type = 'sawtooth'
      this.chargeGain.gain.value = 0.0001
      this.chargeOscillator.connect(this.chargeGain)
      this.chargeGain.connect(this.master)
      this.chargeOscillator.start()
    }
    const now = this.context.currentTime
    this.chargeOscillator.frequency.setTargetAtTime(44 + charge * 4.4, now, 0.04)
    this.chargeGain.gain.setTargetAtTime(charge > 0 ? 0.015 + charge * 0.00045 : 0.0001, now, 0.04)
  }

  getSpectrum(target: Uint8Array<ArrayBuffer>) {
    if (!this.enabled || !this.analyser) {
      target.fill(0)
      return
    }
    this.analyser.getByteFrequencyData(target)
  }

  getEnergy() {
    if (!this.enabled || !this.analyser) return 0
    this.analyser.getByteFrequencyData(this.spectrum)
    let total = 0
    for (let index = 0; index < this.spectrum.length; index += 1) total += this.spectrum[index]
    return total / (this.spectrum.length * 255)
  }

  dispose() {
    if (this.lifecycleAttached) {
      document.removeEventListener('visibilitychange', this.handleVisibility)
      this.lifecycleAttached = false
    }
    this.oscillators.forEach((oscillator) => {
      try { oscillator.stop() } catch { /* already stopped */ }
      oscillator.disconnect()
    })
    this.oscillators = []
    if (this.noise) {
      try { this.noise.stop() } catch { /* already stopped */ }
      this.noise.disconnect()
    }
    this.noiseGain?.disconnect()
    if (this.chargeOscillator) {
      try { this.chargeOscillator.stop() } catch { /* already stopped */ }
      this.chargeOscillator.disconnect()
    }
    this.chargeGain?.disconnect()
    this.ambient?.disconnect()
    this.filter?.disconnect()
    this.analyser?.disconnect()
    this.compressor?.disconnect()
    this.master?.disconnect()
    if (this.context && this.context.state !== 'closed') void this.context.close()
    this.context = null
    this.master = null
    this.ambient = null
    this.filter = null
    this.compressor = null
    this.analyser = null
    this.noise = null
    this.noiseGain = null
    this.noiseBuffer = null
    this.chargeOscillator = null
    this.chargeGain = null
    this.enabled = false
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

export const aetherAudio = new AetherAudioEngine()
