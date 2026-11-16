// Every sound in Emberfall is synthesised with WebAudio — no audio files.
// Short oscillator-and-noise voices make the effects (a bolt's zip, a mote's
// pop, the low thud of a leak), and a slow two-oscillator pad, cycling through
// four roots, is the ambient loop under the game. The context is created
// lazily on the first user gesture, as browsers require; until then, and in
// screenshot scenes, every call is a silent no-op.

const PAD_ROOTS = [110.0, 87.31, 130.81, 98.0]; // A2, F2, C3, G2
const PAD_SECONDS = 9;

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let ambientNodes = null;
  let padTimer = null;
  let padStep = 0;

  /** Create (or resume) the context. Call from a click or key handler. */
  function unlock() {
    if (ctx !== null) {
      if (ctx.state === 'suspended') void ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (Ctor === undefined) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }

  /** One enveloped oscillator voice. */
  function tone({ freq, freqEnd = null, type = 'sine', dur = 0.15, gain = 0.2, delay = 0 }) {
    if (ctx === null || muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** One burst of filtered noise. */
  function noise({ dur = 0.12, gain = 0.2, freq = 1200, delay = 0 }) {
    if (ctx === null || muted) return;
    const t0 = ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.8;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    source.connect(filter).connect(amp).connect(master);
    source.start(t0);
  }

  /** Play one pad chord (root + fifth, detuned triangles through a lowpass). */
  function padChord() {
    if (ctx === null || muted || ambientNodes === null) return;
    const t0 = ctx.currentTime;
    const root = PAD_ROOTS[padStep % PAD_ROOTS.length];
    padStep += 1;
    for (const ratio of [1, 1.5, 2]) {
      for (const detune of [-4, 4]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = root * ratio;
        osc.detune.value = detune;
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(0, t0);
        amp.gain.linearRampToValueAtTime(0.045, t0 + 2.5);
        amp.gain.setValueAtTime(0.045, t0 + PAD_SECONDS - 2.5);
        amp.gain.linearRampToValueAtTime(0, t0 + PAD_SECONDS);
        osc.connect(amp).connect(ambientNodes);
        osc.start(t0);
        osc.stop(t0 + PAD_SECONDS + 0.1);
      }
    }
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master !== null && ctx !== null) {
        master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
      }
      if (muted) this.stopAmbient();
      return muted;
    },
    shoot() {
      tone({ freq: 880, freqEnd: 320, type: 'square', dur: 0.09, gain: 0.06 });
    },
    pop(big = false) {
      noise({ dur: big ? 0.25 : 0.12, gain: big ? 0.3 : 0.18, freq: big ? 700 : 1400 });
      tone({ freq: big ? 220 : 520, freqEnd: 90, type: 'triangle', dur: big ? 0.25 : 0.12, gain: 0.16 });
    },
    leak() {
      tone({ freq: 160, freqEnd: 45, type: 'sawtooth', dur: 0.4, gain: 0.28 });
      noise({ dur: 0.3, gain: 0.12, freq: 300 });
    },
    playerHit() {
      tone({ freq: 340, freqEnd: 70, type: 'sawtooth', dur: 0.35, gain: 0.25 });
      noise({ dur: 0.2, gain: 0.2, freq: 900 });
    },
    waveStart() {
      for (let i = 0; i < 4; i += 1) {
        tone({ freq: 392 * Math.pow(1.335, i), type: 'triangle', dur: 0.22, gain: 0.14, delay: i * 0.09 });
      }
    },
    gameOver() {
      for (let i = 0; i < 4; i += 1) {
        tone({ freq: 440 * Math.pow(0.84, i), type: 'triangle', dur: 0.4, gain: 0.16, delay: i * 0.16 });
      }
    },
    uiClick() {
      tone({ freq: 660, type: 'sine', dur: 0.07, gain: 0.1 });
    },
    startAmbient() {
      if (ctx === null || muted || ambientNodes !== null) return;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      const amp = ctx.createGain();
      amp.gain.value = 0.9;
      filter.connect(amp).connect(master);
      ambientNodes = filter;
      padChord();
      padTimer = window.setInterval(padChord, PAD_SECONDS * 1000);
    },
    stopAmbient() {
      if (padTimer !== null) window.clearInterval(padTimer);
      padTimer = null;
      if (ambientNodes !== null) ambientNodes.disconnect();
      ambientNodes = null;
    },
  };
}
