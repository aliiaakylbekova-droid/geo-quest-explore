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
  | "tick"
  | "tickWarn"

class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicBus: GainNode | null = null
  private sfxBus: GainNode | null = null
  private ambientNodes: OscillatorNode[] = []
  private ambientSources: AudioBufferSourceNode[] = []
  private ambientGain: GainNode | null = null
  private pianoSrc: AudioBufferSourceNode | null = null
  private pianoGain: GainNode | null = null
  private pianoBuffer: AudioBuffer | null = null
  private pianoLoading: Promise<AudioBuffer | null> | null = null
  private pianoWanted = false
  unlocked = false
  musicOn = true
  sfxOn = true
  musicVol = 0.38
  sfxVol = 0.72
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
    if (name === "startClick") this.ping(880, 0.045, 0.035, "sine")
    else if (name === "start") {
      this.ping(196, 0.42, 0.05, "sine")
      this.ping(294, 0.5, 0.04, "sine")
    }
    else if (name === "zoom") this.sweep(90, 160, 0.35, 0.03, "sine")
    else if (name === "discovery") this.ping(523, 0.16, 0.05, "sine")
    else if (name === "success") {
      this.ping(659, 0.14, 0.2, "sine")
      window.setTimeout(() => this.ping(988, 0.2, 0.16, "sine"), 45)
    }
    else if (name === "fail") {
      this.ping(196, 0.12, 0.2, "triangle")
      window.setTimeout(() => this.ping(131, 0.2, 0.18, "sine"), 40)
    }
    else if (name === "tick") this.ping(980, 0.04, 0.022, "sine")
    else if (name === "tickWarn") {
      this.ping(1174, 0.055, 0.07, "triangle")
      window.setTimeout(() => this.ping(1568, 0.04, 0.045, "sine"), 28)
    }
    else if (name === "timeout") {
      this.ping(110, 0.22, 0.1, "sine")
      window.setTimeout(() => this.ping(82, 0.32, 0.09, "sine"), 220)
    }
    else if (name === "gameOver") {
      this.sweep(147, 55, 1.4, 0.09, "sine")
      this.ping(98, 0.8, 0.08, "sine")
      window.setTimeout(() => this.ping(73, 1.1, 0.07, "triangle"), 280)
    }
    else if (name === "xp") this.ping(740, 0.05, 0.04, "sine")
    else if (name === "unlock") this.ping(523, 0.18, 0.06, "sine")
    else if (name === "transition") this.sweep(120, 180, 0.4, 0.03, "sine")
    else if (name === "missionComplete") {
      this.ping(392, 0.28, 0.08, "sine")
      window.setTimeout(() => this.ping(523, 0.35, 0.07, "sine"), 160)
    }
  }

  private ping(freq: number, dur: number, vol: number, type: OscillatorType) {
    if (!this.sfxOn || !this.ctx || !this.sfxBus) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(Math.max(0.0001, vol), t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.sfxBus)
    osc.start(t)
    osc.stop(t + dur + 0.03)
  }

  private sweep(from: number, to: number, dur: number, vol: number, type: OscillatorType = "sine") {
    if (!this.sfxOn || !this.ctx || !this.sfxBus) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.sfxBus)
    osc.start(t)
    osc.stop(t + dur + 0.03)
  }

  private noiseBuffer(ctx: AudioContext) {
    const len = ctx.sampleRate * 6
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i += 1) {
      const white = Math.random() * 2 - 1
      last = (last + 0.015 * white) / 1.015
      data[i] = last * 4.2
    }
    return buf
  }

  startAmbient() {
    if (!this.unlocked || !this.musicOn) return
    this.pianoWanted = true
    if (this.pianoGain || this.ambientGain) return
    void this.startPianoLoop()
  }

  private loadPiano() {
    if (this.pianoBuffer) return Promise.resolve(this.pianoBuffer)
    if (this.pianoLoading) return this.pianoLoading
    const ctx = this.ensure()
    this.pianoLoading = (async () => {
      try {
        const url = `${import.meta.env.BASE_URL}audio/piano-nocturne-loop.wav`
        const res = await fetch(url)
        if (!res.ok) return null
        const raw = await res.arrayBuffer()
        this.pianoBuffer = await ctx.decodeAudioData(raw.slice(0))
        return this.pianoBuffer
      } catch {
        return null
      }
    })()
    return this.pianoLoading
  }

  private async startPianoLoop() {
    const ctx = this.ensure()
    const buf = await this.loadPiano()
    if (!this.pianoWanted || !this.unlocked || !this.musicOn) return
    if (this.pianoGain || this.ambientGain) return
    if (!buf) {
      this.startPadFallback()
      return
    }
    const g = ctx.createGain()
    g.gain.value = 0.0001
    g.connect(this.musicBus!)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    src.connect(g)
    src.start()
    g.gain.exponentialRampToValueAtTime(0.26, ctx.currentTime + 1.6)
    this.pianoGain = g
    this.pianoSrc = src
  }

  private startPadFallback() {
    if (!this.unlocked || !this.musicOn) return
    const ctx = this.ensure()
    if (this.ambientGain || this.pianoGain) return
    const g = ctx.createGain()
    g.gain.value = 0.0001
    g.connect(this.musicBus!)

    const pads = [
      { f: 55, type: "sine" as OscillatorType },
      { f: 82.4, type: "sine" as OscillatorType },
      { f: 110, type: "triangle" as OscillatorType },
      { f: 164.8, type: "sine" as OscillatorType },
    ]
    this.ambientNodes = pads.map((pad) => {
      const osc = ctx.createOscillator()
      osc.type = pad.type
      osc.frequency.value = pad.f
      const filt = ctx.createBiquadFilter()
      filt.type = "lowpass"
      filt.frequency.value = 420
      filt.Q.value = 0.4
      osc.connect(filt)
      filt.connect(g)
      osc.start()
      return osc
    })

    const lfo = ctx.createOscillator()
    lfo.type = "sine"
    lfo.frequency.value = 0.05
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.012
    lfo.connect(lfoGain)
    lfoGain.connect(g.gain)
    lfo.start()
    this.ambientNodes.push(lfo)

    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer(ctx)
    noise.loop = true
    const noiseFilt = ctx.createBiquadFilter()
    noiseFilt.type = "lowpass"
    noiseFilt.frequency.value = 280
    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.018
    noise.connect(noiseFilt)
    noiseFilt.connect(noiseGain)
    noiseGain.connect(g)
    noise.start()
    this.ambientSources = [noise]

    g.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 2.4)
    this.ambientGain = g
  }

  stopAmbient() {
    this.pianoWanted = false
    const ctx = this.ctx
    if (this.pianoSrc) {
      try {
        this.pianoSrc.stop()
      } catch {
        /* already stopped */
      }
      this.pianoSrc = null
    }
    if (this.pianoGain && ctx) {
      try {
        this.pianoGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
      } catch {
        /* closed */
      }
      this.pianoGain.disconnect()
      this.pianoGain = null
    }
    this.ambientSources.forEach((s) => {
      try {
        s.stop()
      } catch {
        /* already stopped */
      }
    })
    this.ambientSources = []
    if (this.ambientGain && ctx) {
      this.ambientGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6)
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
