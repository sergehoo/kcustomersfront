/**
 * The visit's sound, in one place.
 *
 *   AudioExperience
 *   ├── music        two loops (day, night), cross-faded — the only files
 *   ├── exterior     open-air bed, leaves in the gusts, insects at night
 *   ├── birds        calls, never a loop: a phrase now and then
 *   ├── wind         a body of air that follows the same gusts as the plants
 *   ├── room         interior room tone
 *   ├── tv           the sound of the film on the living-room screen (3D)
 *   ├── pool         water lapping against the coping
 *   └── ui           the one soft cue of the sound control
 *
 * One AudioContext, one gain per layer, everything faded: nothing in here
 * ever starts or stops at full level. The scene decides the level of each
 * layer (mix.ts); this file only knows how to make the sounds and how to
 * move a gain smoothly.
 *
 * The garden, the rooms and the water are synthesised in the browser —
 * filtered noise, a few oscillators — so that part of the soundscape costs no
 * download, can follow the picture frame by frame (gusts, a bird crossing the
 * sky) and has no licence to track. The television is the one layer that
 * comes from outside: the soundtrack of the video its screen plays
 * (Television.tsx), routed through here so that it is placed in the room,
 * faded like everything else and silenced by the same mute.
 *
 * Browsers only allow sound after a gesture: `start()` must be called from a
 * click or a key press. Until then nothing is created at all.
 */
export type LayerId = 'music' | 'exterior' | 'birds' | 'wind' | 'room' | 'tv' | 'pool' | 'ui'
export type Mix = Record<Exclude<LayerId, 'ui'>, number>
export type SoundMode = 'day' | 'night'

/**
 * `period` is the exact length of the loop. Each file carries 0.4 s of the
 * loop's own tail before it and of its head after it, so the loop points
 * fall inside the audio and an MP3 decoder's padding cannot open a gap.
 */
const MUSIC: Record<SoundMode, { url: string; lead: number; period: number }> = {
  day: { url: '/audio/music-day.mp3', lead: .4, period: 96 },
  night: { url: '/audio/music-night.mp3', lead: .4, period: 88 },
}

const LAYERS: LayerId[] = ['music', 'exterior', 'birds', 'wind', 'room', 'tv', 'pool', 'ui']
/** Seconds for a layer to cover ~63 % of a change: about 1.5 s to settle. */
const FADE = .5
/**
 * The two layers of the television's hand-over move faster: the film is up
 * in about 0.7 s and the music has ducked under it within a second.
 */
const FADES: Partial<Record<LayerId, number>> = { tv: .22, music: .32 }
/** How far ahead of the clock events are written. */
const AHEAD = .7

const random = (low: number, high: number) => low + Math.random() * (high - low)

type Track = { gain: GainNode; source: AudioBufferSourceNode | null; requested: boolean }

export class AudioExperience {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private layers = {} as Record<LayerId, GainNode>
  private targets = {} as Record<LayerId, number>
  private tracks = {} as Record<SoundMode, Track>
  private mode: SoundMode = 'day'
  private muted = true
  private timer = 0

  private noise: Partial<Record<'white' | 'pink' | 'brown', AudioBuffer>> = {}
  private windBody: GainNode | null = null
  private windBand: BiquadFilterNode | null = null
  private windPan: StereoPannerNode | null = null
  private rustle: GainNode | null = null
  private insects: GainNode | null = null
  private insectPulse: GainNode | null = null
  private insectClock = 0
  private lap: GainNode | null = null
  private lapClock = 0
  private birdBus: GainNode | null = null
  private birdClock = 0
  private birdPresence = 0
  private birdPan = 0
  private lastCall = -1
  private panner: PannerNode | null = null
  private screen: HTMLMediaElement | null = null
  private screenSource: MediaElementAudioSourceNode | null = null
  private television: [number, number, number] = [.25, 5.45, 11.25]

  /** True once sound may actually be heard. */
  get audible() {
    return Boolean(this.context) && !this.muted && this.context!.state === 'running'
  }

  /**
   * Call from a user gesture. Builds the graph on first use, resumes the
   * context and fades the whole mix in. Resolves to whether sound is playing:
   * a browser may still refuse, and the visit goes on without it.
   */
  async start(mode: SoundMode) {
    this.mode = mode
    try {
      if (!this.context) this.build()
      const context = this.context!
      if (context.state !== 'running') await context.resume()
      if (context.state !== 'running') return false
      this.muted = false
      this.play(mode)
      const now = context.currentTime
      this.master!.gain.cancelScheduledValues(now)
      this.master!.gain.setValueAtTime(Math.max(.0001, this.master!.gain.value), now)
      this.master!.gain.linearRampToValueAtTime(1, now + 2.4)
      if (!this.timer) this.timer = window.setInterval(() => this.schedule(), 240)
      this.cue()
      return true
    } catch {
      return false
    }
  }

  /** Fades everything out, then lets the audio thread sleep. */
  mute() {
    const context = this.context
    this.muted = true
    if (!context || !this.master) return
    const now = context.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setTargetAtTime(0, now, .18)
    window.setTimeout(() => { if (this.muted && context.state === 'running') void context.suspend() }, 1100)
  }

  /** The tab went to the background, or came back. */
  hold(hidden: boolean) {
    const context = this.context
    if (!context || this.muted) return
    if (hidden) void context.suspend()
    else void context.resume()
  }

  /** Day or night: the two pieces of music cross over three seconds. */
  setMode(mode: SoundMode) {
    if (mode === this.mode && this.tracks[mode]?.requested) return
    this.mode = mode
    if (this.context && !this.muted) this.play(mode)
  }

  /** Target level of every layer, from the scene. */
  setMix(mix: Mix) {
    const context = this.context
    if (!context) return
    const now = context.currentTime
    for (const id of Object.keys(mix) as (keyof Mix)[]) {
      const value = Math.max(0, mix[id])
      if (Math.abs((this.targets[id] ?? -1) - value) < .002) continue
      this.targets[id] = value
      this.layers[id].gain.setTargetAtTime(value, now, FADES[id] ?? FADE)
    }
  }

  /** Where the camera is and where it looks, for the television. */
  setListener(position: { x: number; y: number; z: number }, forward: { x: number; y: number; z: number }) {
    const context = this.context
    if (!context) return
    const listener = context.listener
    const now = context.currentTime
    if (listener.positionX) {
      listener.positionX.setTargetAtTime(position.x, now, .08)
      listener.positionY.setTargetAtTime(position.y, now, .08)
      listener.positionZ.setTargetAtTime(position.z, now, .08)
      listener.forwardX.setTargetAtTime(forward.x, now, .08)
      listener.forwardY.setTargetAtTime(forward.y, now, .08)
      listener.forwardZ.setTargetAtTime(forward.z, now, .08)
    } else {
      // Older Safari.
      listener.setPosition(position.x, position.y, position.z)
      listener.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0)
    }
  }

  /**
   * The video the living-room screen plays. Its sound leaves the element and
   * enters the graph here — one place where it is heard, placed and muted. May
   * be called before any gesture: the wiring waits for the context.
   */
  attachTelevision(element: HTMLMediaElement) {
    this.screen = element
    if (this.context) this.wireTelevision()
  }

  /** Where the screen hangs, read from the model. */
  setTelevision(x: number, y: number, z: number) {
    this.television = [x, y, z]
    if (this.panner) this.place(this.panner)
  }

  /**
   * The gust the plants are in right now (0–1) and where it comes from
   * (−1 left … 1 right): the air is heard rising as the fronds lift.
   */
  setWind(gust: number, pan: number) {
    const context = this.context
    if (!context || !this.windBody) return
    const now = context.currentTime
    this.windBody.gain.setTargetAtTime(.3 + .7 * gust, now, .5)
    this.windBand!.frequency.setTargetAtTime(300 + 460 * gust, now, .7)
    this.windPan!.pan.setTargetAtTime(pan, now, .9)
    this.rustle!.gain.setTargetAtTime(.04 + .5 * gust * gust, now, .4)
  }

  /** How many of the birds in the sky are in frame (0–1), and on which side. */
  setBirds(presence: number, pan: number) {
    this.birdPresence = presence
    this.birdPan = pan
  }

  /**
   * A handful of birds leaving the palms: a few soft puffs of air, close
   * together, thinning out as they get away. Silent if the sound is off.
   */
  flutter() {
    const context = this.context
    if (!context || this.muted || context.state !== 'running') return
    const band = this.filter('bandpass', 1250, .9)
    band.connect(this.layers.birds)
    let at = context.currentTime + .04
    for (let i = 0; i < 11; i += 1) {
      const puff = context.createBufferSource()
      const envelope = this.gain(0)
      puff.buffer = this.noise.white!
      envelope.gain.setValueAtTime(0, at)
      envelope.gain.linearRampToValueAtTime(random(.5, .9) * (1 - i / 14), at + .012)
      envelope.gain.exponentialRampToValueAtTime(.0005, at + .075)
      puff.connect(envelope).connect(band)
      puff.start(at, Math.random())
      puff.stop(at + .1)
      at += random(.06, .1) + i * .006
    }
  }

  dispose() {
    window.clearInterval(this.timer)
    this.timer = 0
    void this.context?.close()
    this.context = null
  }

  // ── graph ──────────────────────────────────────────────────────────────────
  private build() {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const context = new Context({ latencyHint: 'playback' })
    this.context = context

    // A gentle safety net: with every layer up the sum stays far below full
    // scale, and this keeps a stray peak from ever clipping.
    const limiter = context.createDynamicsCompressor()
    limiter.threshold.value = -9
    limiter.knee.value = 12
    limiter.ratio.value = 4
    limiter.attack.value = .01
    limiter.release.value = .3
    limiter.connect(context.destination)
    this.master = context.createGain()
    this.master.gain.value = 0
    this.master.connect(limiter)
    for (const id of LAYERS) {
      const gain = context.createGain()
      gain.gain.value = id === 'ui' ? .5 : 0
      gain.connect(this.master)
      this.layers[id] = gain
    }

    this.noise.white = this.makeNoise(2, 'white')
    this.noise.pink = this.makeNoise(5, 'pink')
    this.noise.brown = this.makeNoise(5, 'brown')

    this.buildWind()
    this.buildExterior()
    this.buildRoom()
    this.buildPool()
    this.buildBirds()
    this.wireTelevision()
    const now = context.currentTime
    this.lapClock = this.birdClock = this.insectClock = now + .5
  }

  private makeNoise(seconds: number, colour: 'white' | 'pink' | 'brown') {
    const context = this.context!
    const length = Math.floor(seconds * context.sampleRate)
    const buffer = context.createBuffer(2, length, context.sampleRate)
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0
      for (let i = 0; i < length; i += 1) {
        const white = Math.random() * 2 - 1
        if (colour === 'white') data[i] = white * .5
        else if (colour === 'pink') {
          // Paul Kellet's filter.
          b0 = .99886 * b0 + white * .0555179; b1 = .99332 * b1 + white * .0750759; b2 = .969 * b2 + white * .153852
          b3 = .8665 * b3 + white * .3104856; b4 = .55 * b4 + white * .5329522; b5 = -.7616 * b5 - white * .016898
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * .5362) * .11
          b6 = white * .115926
        } else {
          last = (last + .02 * white) / 1.02
          data[i] = last * 3.5
        }
      }
      // The loop closes on itself: the last 50 ms melt into the first.
      const blend = Math.floor(.05 * context.sampleRate)
      for (let i = 0; i < blend; i += 1) {
        const t = i / blend
        data[length - blend + i] = data[length - blend + i] * (1 - t) + data[i] * t
      }
    }
    return buffer
  }

  private loop(colour: 'white' | 'pink' | 'brown', rate = 1) {
    const source = this.context!.createBufferSource()
    source.buffer = this.noise[colour]!
    source.loop = true
    source.playbackRate.value = rate
    source.start(0, Math.random() * 2)
    return source
  }

  private filter(type: BiquadFilterType, frequency: number, q = .7) {
    const node = this.context!.createBiquadFilter()
    node.type = type
    node.frequency.value = frequency
    node.Q.value = q
    return node
  }

  private gain(value: number) {
    const node = this.context!.createGain()
    node.gain.value = value
    return node
  }

  /** Air with a body: brown noise through a band that opens with the gust. */
  private buildWind() {
    const context = this.context!
    this.windBand = this.filter('bandpass', 420, .55)
    this.windBody = this.gain(.4)
    this.windPan = context.createStereoPanner()
    this.loop('brown').connect(this.windBand).connect(this.windBody).connect(this.windPan)
    // A second, slower stream, so the wind is never one hiss.
    const low = this.filter('lowpass', 210, .4)
    this.loop('brown', .8).connect(low).connect(this.gain(.55)).connect(this.windPan)
    this.windPan.connect(this.layers.wind)
  }

  /** The open air: a far-off bed, leaves in the gusts, insects after dark. */
  private buildExterior() {
    const context = this.context!
    this.loop('pink').connect(this.filter('lowpass', 620, .3)).connect(this.gain(.55)).connect(this.layers.exterior)
    // Leaves: the top of the spectrum, let through by the gust (setWind).
    this.rustle = this.gain(.05)
    this.loop('pink', 1.15).connect(this.filter('highpass', 2100, .5)).connect(this.filter('lowpass', 7200, .4)).connect(this.rustle).connect(this.layers.exterior)
    // Crickets: two close tones gated into short pulses (schedule()).
    this.insects = this.gain(0)
    this.insectPulse = this.gain(0)
    for (const frequency of [4380, 4710]) {
      const tone = context.createOscillator()
      tone.frequency.value = frequency
      tone.connect(this.insectPulse)
      tone.start()
    }
    this.insectPulse.connect(this.filter('bandpass', 4500, 3)).connect(this.insects).connect(this.layers.exterior)
  }

  /** A room with its windows shut: almost nothing, but not digital silence. */
  private buildRoom() {
    this.loop('brown', .7).connect(this.filter('lowpass', 150, .4)).connect(this.gain(.9)).connect(this.layers.room)
    this.loop('pink', .9).connect(this.filter('bandpass', 480, .35)).connect(this.gain(.1)).connect(this.layers.room)
  }

  /** Water against stone: a wash that swells and ebbs, and small plinks. */
  private buildPool() {
    this.lap = this.gain(.3)
    this.loop('pink', .9).connect(this.filter('bandpass', 1150, .7)).connect(this.lap)
    this.loop('white', .6).connect(this.filter('bandpass', 2600, 1.1)).connect(this.gain(.22)).connect(this.lap)
    // Brought up to the loudness of the other layers, so the mix table reads true.
    this.lap.connect(this.gain(2.4)).connect(this.layers.pool)
  }

  /** Calls go through a short echo: birds are heard across a valley. */
  private buildBirds() {
    const context = this.context!
    this.birdBus = this.gain(1)
    const echo = context.createDelay(.5)
    echo.delayTime.value = .21
    const feedback = this.gain(.26)
    const far = this.filter('lowpass', 3600, .4)
    this.birdBus.connect(this.layers.birds)
    this.birdBus.connect(echo)
    echo.connect(far).connect(feedback).connect(echo)
    far.connect(this.gain(.5)).connect(this.layers.birds)
  }

  private place(panner: PannerNode) {
    const [x, y, z] = this.television
    if (panner.positionX) {
      panner.positionX.value = x
      panner.positionY.value = y
      panner.positionZ.value = z
    } else panner.setPosition(x, y, z)
  }

  /**
   * The screen's sound, in the room. Distance only takes a little off: the
   * film must stay intelligible from the sofa as from the fireplace.
   *
   * The filtering is a dialogue EQ. The film carries its own music bed under
   * the voice, continuous and heavy in the bass (as much energy under 250 Hz
   * as in the whole speech band): in a room that already has the visit's
   * music, it read as "the music is loud" rather than as someone speaking.
   * Cutting the lows and lifting the presence takes about 8 dB off that bed
   * and under 2 dB off the voice — which is also what a flat screen's small
   * speakers do.
   */
  private wireTelevision() {
    const context = this.context
    if (!context || !this.screen || this.screenSource) return
    const panner = context.createPanner()
    panner.panningModel = 'equalpower'
    panner.distanceModel = 'inverse'
    panner.refDistance = 3
    panner.rolloffFactor = .6
    panner.maxDistance = 40
    this.place(panner)
    panner.connect(this.layers.tv)
    this.panner = panner
    // An element can feed one graph only, and only once.
    this.screenSource = context.createMediaElementSource(this.screen)
    const shelf = this.filter('lowshelf', 380)
    shelf.gain.value = -5
    const presence = this.filter('peaking', 2700, .9)
    presence.gain.value = 4
    this.screenSource.connect(this.filter('highpass', 210, .7)).connect(shelf).connect(presence).connect(this.filter('lowpass', 9000, .5)).connect(panner)
  }

  // ── music ──────────────────────────────────────────────────────────────────
  private play(mode: SoundMode) {
    const context = this.context!
    for (const key of ['day', 'night'] as SoundMode[]) {
      if (!this.tracks[key]) {
        const gain = this.gain(0)
        gain.connect(this.layers.music)
        this.tracks[key] = { gain, source: null, requested: false }
      }
      // Only the piece in use is ever downloaded; the other waits for a switch.
      this.tracks[key].gain.gain.setTargetAtTime(key === mode ? 1 : 0, context.currentTime, 1)
    }
    const track = this.tracks[mode]
    if (track.requested) return
    track.requested = true
    const { url, lead, period } = MUSIC[mode]
    fetch(url)
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        if (context.state === 'closed') return
        const source = context.createBufferSource()
        source.buffer = buffer
        source.loop = true
        source.loopStart = lead
        source.loopEnd = lead + period
        source.connect(track.gain)
        source.start(0, lead)
        track.source = source
      })
      // No music is not an error worth showing: the soundscape still plays.
      .catch(() => { track.requested = false })
  }

  // ── events written ahead of the clock ──────────────────────────────────────
  private schedule() {
    const context = this.context
    if (!context || context.state !== 'running') return
    const now = context.currentTime
    const horizon = now + AHEAD
    this.scheduleWater(now, horizon)
    this.scheduleBirds(now)
    this.scheduleInsects(now, horizon)
  }

  private scheduleWater(now: number, horizon: number) {
    if ((this.targets.pool ?? 0) < .004) { this.lapClock = now; return }
    while (this.lapClock < horizon) {
      const at = Math.max(now, this.lapClock)
      // A small wave reaches the coping and runs out.
      const swell = random(.35, 1)
      this.lap!.gain.setTargetAtTime(swell, at, .3)
      this.lap!.gain.setTargetAtTime(.18, at + random(.5, .9), .45)
      if (Math.random() < .75) this.plink(at + random(.05, .6))
      if (Math.random() < .35) this.plink(at + random(.3, 1.1))
      this.lapClock = at + random(1.3, 2.6)
    }
  }

  /** One drop finding the surface: a short tone that rises as it closes. */
  private plink(at: number) {
    const context = this.context!
    const tone = context.createOscillator()
    const envelope = this.gain(0)
    const pan = context.createStereoPanner()
    const frequency = random(520, 1500)
    const length = random(.04, .09)
    tone.frequency.setValueAtTime(frequency, at)
    tone.frequency.exponentialRampToValueAtTime(frequency * random(1.25, 1.7), at + length)
    envelope.gain.setValueAtTime(0, at)
    envelope.gain.linearRampToValueAtTime(random(.09, .26), at + .006)
    envelope.gain.exponentialRampToValueAtTime(.0005, at + length)
    pan.pan.value = random(-.7, .7)
    tone.connect(envelope).connect(pan).connect(this.layers.pool)
    tone.start(at)
    tone.stop(at + length + .02)
  }

  private scheduleBirds(now: number) {
    if ((this.targets.birds ?? 0) < .004) { this.birdClock = now + random(1, 3); return }
    if (now < this.birdClock) return
    // Birds in frame call more often and from where they are; otherwise the
    // garden has a call now and then, off to one side.
    const seen = this.birdPresence > .12
    const pan = seen ? this.birdPan * .8 : random(-.75, .75)
    const level = seen ? random(.7, 1) : random(.3, .6)
    this.call(now + .08, pan, level)
    if (seen && Math.random() < .5) this.call(now + random(.7, 1.5), pan + random(-.25, .25), level * .7)
    this.birdClock = now + (seen ? random(2.4, 5.5) : random(7, 16))
  }

  /** One phrase, never the same twice running. */
  private call(at: number, pan: number, level: number) {
    let kind = Math.floor(Math.random() * 5)
    if (kind === this.lastCall) kind = (kind + 1) % 5
    this.lastCall = kind
    const note = (start: number, from: number, to: number, length: number, gain = 1) => this.note(at + start, from, to, length, level * gain, pan)
    const pitch = random(.92, 1.1)
    if (kind === 0) {
      note(0, 3400 * pitch, 2700 * pitch, .13)
      note(.19, 3050 * pitch, 2400 * pitch, .16, .85)
    } else if (kind === 1) {
      const count = 5 + Math.floor(Math.random() * 4)
      for (let i = 0; i < count; i += 1) note(i * .062, (i % 2 ? 4650 : 4200) * pitch, (i % 2 ? 4400 : 4500) * pitch, .042, .7 - i * .04)
    } else if (kind === 2) {
      note(0, 2300 * pitch, 3900 * pitch, .2)
      note(.27, 3900 * pitch, 3450 * pitch, .09, .7)
    } else if (kind === 3) {
      note(0, 2900 * pitch, 2950 * pitch, .1, .8)
      note(.15, 3500 * pitch, 3400 * pitch, .1)
      note(.3, 3100 * pitch, 2850 * pitch, .14, .9)
    } else {
      note(0, 3700 * pitch, 3000 * pitch, .07, .8)
      note(.1, 3700 * pitch, 3000 * pitch, .07, .8)
      note(.2, 3300 * pitch, 2500 * pitch, .22)
    }
  }

  private note(at: number, from: number, to: number, length: number, level: number, pan: number) {
    const context = this.context!
    const tone = context.createOscillator()
    const envelope = this.gain(0)
    const side = context.createStereoPanner()
    tone.frequency.setValueAtTime(from, at)
    tone.frequency.exponentialRampToValueAtTime(to, at + length)
    envelope.gain.setValueAtTime(0, at)
    envelope.gain.linearRampToValueAtTime(.95 * level, at + Math.min(.02, length * .3))
    envelope.gain.exponentialRampToValueAtTime(.0005, at + length)
    side.pan.value = Math.max(-1, Math.min(1, pan))
    tone.connect(envelope).connect(side).connect(this.birdBus!)
    tone.start(at)
    tone.stop(at + length + .02)
  }

  private scheduleInsects(now: number, horizon: number) {
    const night = this.mode === 'night'
    this.insects!.gain.setTargetAtTime(night ? .05 : 0, now, 1.2)
    if (!night) { this.insectClock = now; return }
    while (this.insectClock < horizon) {
      const at = Math.max(now, this.insectClock)
      const pulses = 2 + Math.floor(Math.random() * 3)
      for (let i = 0; i < pulses; i += 1) {
        const start = at + i * .042
        this.insectPulse!.gain.setValueAtTime(0, start)
        this.insectPulse!.gain.linearRampToValueAtTime(1, start + .006)
        this.insectPulse!.gain.linearRampToValueAtTime(0, start + .024)
      }
      this.insectClock = at + random(.55, 1.5)
    }
  }

  /** The sound control answering: two soft notes, once. */
  private cue() {
    const context = this.context!
    const at = context.currentTime + .05
    for (const [offset, frequency] of [[0, 659.3], [.11, 987.8]] as const) {
      const tone = context.createOscillator()
      const envelope = this.gain(0)
      tone.frequency.value = frequency
      envelope.gain.setValueAtTime(0, at + offset)
      envelope.gain.linearRampToValueAtTime(.05, at + offset + .015)
      envelope.gain.exponentialRampToValueAtTime(.0005, at + offset + .5)
      tone.connect(envelope).connect(this.layers.ui)
      tone.start(at + offset)
      tone.stop(at + offset + .55)
    }
  }
}
