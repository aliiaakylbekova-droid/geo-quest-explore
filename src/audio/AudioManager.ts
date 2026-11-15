type Sfx =
  | "start"
  | "startClick"
  | "ambient"
  | "zoom"
  | "discovery"
  | "success"
  | "fail"
  | "xp"
  | "unlock"
  | "transition"
  | "missionComplete"
  | "timeout"
  | "gameOver"

class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicBus: GainNode | null = null
  private sfxBus: GainNode | null = null
  private ambientNodes: OscillatorNode[] = []
  private ambientGain: GainNode | null = null
  private motifTimer = 0
  private motifStep = 0
  unlocked = false
  musicOn = true
  sfxOn = true
  musicVol = 0.32
  sfxVol = 0.7
  masterVol = 0.7

  private ensure() {
    if (this.ctx) return this.ctx
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.musicBus = this.ctx.createGain()
    this.sfxBus = this.ctx.createGain()
    this.musicBus.connect(this.master)
    this.sfxBus.connect(this.master)
    this.master.connect(this.ctx.destination)
    this.applyGains()
    return this.ctx
  }

  applyGains() {
    if (!this.master || !this.musicBus || !this.sfxBus) return
    this.master.gain.value = this.masterVol
    this.musicBus.gain.value = this.musicOn ? this.musicVol : 0
    this.sfxBus.gain.value = this.sfxOn ? this.sfxVol : 0
  }

  setMusic(on: boolean) {
    this.musicOn = on
    this.applyGains()
    if (on && this.unlocked) this.startAmbient()
    if (!on) this.stopAmbient()
  }

  setSfx(on: boolean) {
    this.sfxOn = on
    this.applyGains()
  }

  setMusicVol(v: number) {
    this.musicVol = v
    this.applyGains()
  }

  setSfxVol(v: number) {
    this.sfxVol = v
    this.applyGains()
  }

  setMaster(v: number) {
    this.masterVol = v
    this.applyGains()
  }

  unlock() {
    const ctx = this.ensure()
    if (ctx.state === "suspended") void ctx.resume()
    this.unlocked = true
  }

  play(name: Sfx) {
    if (!this.unlocked) return
    const ctx = this.ensure()
    if (ctx.state === "suspended") void ctx.resume()
    if (name === "ambient") {
      this.startAmbient()
      return
    }
    if (name === "startClick") this.blip(520, 0.09, "triangle")
    else if (name === "start") this.arpeggio([196, 247, 294, 392], 0.12, 0.16)
    else if (name === "zoom") this.sweep(180, 520, 0.42, 0.08)
    else if (name === "discovery") this.arpeggio([523, 659, 784], 0.1, 0.11)
    else if (name === "success") {
      this.arpeggio([523, 659, 784, 1046], 0.08, 0.12)
      this.blip(1318, 0.1, "sine")
    }
    else if (name === "fail") {
      this.sweep(320, 68, 0.44, 0.16)
      this.blip(62, 0.24, "sine")
      window.setTimeout(() => this.sweep(190, 48, 0.28, 0.09), 70)
    }
    else if (name === "timeout") {
      this.blip(196, 0.11, "square")
      window.setTimeout(() => this.blip(147, 0.13, "square"), 130)
      window.setTimeout(() => this.sweep(130, 42, 0.55, 0.15), 270)
    }
    else if (name === "gameOver") {
      this.sweep(196, 55, 1.05, 0.16)
      this.blip(98, 0.45, "sine")
      window.setTimeout(() => this.blip(73, 0.55, "triangle"), 220)
      window.setTimeout(() => this.sweep(110, 40, 0.8, 0.12), 480)
    }
    else if (name === "xp") this.blip(880, 0.06, "sine")
    else if (name === "unlock") this.arpeggio([659, 784, 988, 1175], 0.08, 0.1)
    else if (name === "transition") this.sweep(240, 640, 0.55, 0.06)
    else if (name === "missionComplete") this.arpeggio([262, 330, 392, 523, 659], 0.12, 0.15)
  }

  private bus() {
    return this.sfxBus!
  }

  private blip(freq: number, dur: number, type: OscillatorType) {
    if (!this.sfxOn || !this.ctx || !this.sfxBus) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.bus())
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private sweep(from: number, to: number, dur: number, vol: number) {
    if (!this.sfxOn || !this.ctx || !this.sfxBus) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.04)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.bus())
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private arpeggio(notes: number[], step: number, dur: number) {
    notes.forEach((n, i) => {
      window.setTimeout(() => this.blip(n, dur, i % 2 ? "triangle" : "sine"), i * step * 1000)
    })
  }

  private musicTone(freq: number, dur: number, vol: number) {
    if (!this.musicOn || !this.ctx || !this.musicBus) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.04)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.musicBus)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  startAmbient() {
    if (!this.unlocked || !this.musicOn) return
    const ctx = this.ensure()
    if (this.ambientGain) {
      this.ensureMotif()
      return
    }
    const g = ctx.createGain()
    g.gain.value = 0.0001
    g.connect(this.musicBus!)
    const freqs = [98, 146.8, 196, 246.9]
    this.ambientNodes = freqs.map((f, i) => {
      const osc = ctx.createOscillator()
      osc.type = i % 2 ? "triangle" : "sine"
      osc.frequency.value = f
      const filt = ctx.createBiquadFilter()
      filt.type = "lowpass"
      filt.frequency.value = 720
      osc.connect(filt)
      filt.connect(g)
      osc.start()
      return osc
    })
    g.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 1.4)
    this.ambientGain = g
    this.ensureMotif()
  }

  private ensureMotif() {
    if (this.motifTimer) return
    const notes = [196, 247, 294, 247, 220, 165, 196, 147]
    const tick = () => {
      this.musicTone(notes[this.motifStep % notes.length], 0.58, 0.022)
      this.motifStep += 1
    }
    tick()
    this.motifTimer = window.setInterval(tick, 760)
  }

  stopAmbient() {
    const ctx = this.ctx
    if (this.motifTimer) {
      window.clearInterval(this.motifTimer)
      this.motifTimer = 0
    }
    if (this.ambientGain && ctx) {
      this.ambientGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
    }
    this.ambientNodes.forEach((o) => {
      try {
        o.stop()
      } catch {
        /* already stopped */
      }
    })
    this.ambientNodes = []
    this.ambientGain = null
  }
}

export const audio = new AudioManager()
