// Solmara procedural WebAudio synthesizer: zero-asset audio for engine hum, sirens, impacts, chimes, and ambient synth.

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
    this.initialized = false;

    // Subsystems
    this.engineGain = null;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.isEngineRunning = false;

    this.sirenGain = null;
    this.sirenOsc = null;
    this.sirenLfo = null;
    this.isSirenRunning = false;

    this.ambientGain = null;
    this.ambientStep = 0;
    this.ambientTimer = null;

    // Load mute preference
    try {
      const savedMute = localStorage.getItem('solmara_muted');
      if (savedMute !== null) {
        this.isMuted = savedMute === 'true';
      }
    } catch (_) {}

    // Auto-init on first user gesture
    this.handleFirstGesture = this.handleFirstGesture.bind(this);
    window.addEventListener('click', this.handleFirstGesture, { once: true });
    window.addEventListener('keydown', this.handleFirstGesture, { once: true });
  }

  handleFirstGesture() {
    this.initContext();
  }

  initContext() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 0.7;
      this.masterGain.connect(this.ctx.destination);

      this.initEngineSynth();
      this.initSirenSynth();
      this.startAmbientMusic();

      this.initialized = true;
    } catch (e) {
      console.warn('WebAudio initialization deferred:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
    try {
      localStorage.setItem('solmara_muted', String(this.isMuted));
    } catch (_) {}
    return this.isMuted;
  }

  // --- 1. Procedural Engine Sound ---
  initEngineSynth() {
    if (!this.ctx) return;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 400;

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 45;

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.value = 45.4; // slight detune for rumble

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();
    this.isEngineRunning = true;
  }

  updateEngine(isDriving, speed, maxSpeed, throttleInput) {
    if (!this.initialized || !this.engineGain) return;
    this.resume();

    const t = this.ctx.currentTime;
    if (!isDriving) {
      this.engineGain.gain.setTargetAtTime(0, t, 0.1);
      return;
    }

    const normSpeed = Math.min(1.0, Math.abs(speed) / (maxSpeed || 35.0));
    const throttleBonus = throttleInput > 0 ? 0.35 : 0;

    // Pitch follows engine RPM
    const baseFreq = 42 + normSpeed * 120 + (throttleInput > 0 ? 25 : 0);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.01, t, 0.08);

    // Filter opens up as car accelerates
    const cutoff = 300 + normSpeed * 900 + (throttleInput > 0 ? 400 : 0);
    this.engineFilter.frequency.setTargetAtTime(cutoff, t, 0.08);

    // Volume level
    const targetGain = 0.18 + normSpeed * 0.22 + throttleBonus;
    this.engineGain.gain.setTargetAtTime(targetGain, t, 0.08);
  }

  // --- 2. Police Siren Synthesizer ---
  initSirenSynth() {
    if (!this.ctx) return;

    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;

    this.sirenFilter = this.ctx.createBiquadFilter();
    this.sirenFilter.type = 'bandpass';
    this.sirenFilter.frequency.value = 850;
    this.sirenFilter.Q.value = 1.8;

    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sawtooth';
    this.sirenOsc.frequency.value = 750;

    // LFO to modulate siren pitch (wailing siren effect)
    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.frequency.value = 0.5; // wail cycle every 2s

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 220; // swings +/- 220Hz

    this.sirenLfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);

    this.sirenOsc.connect(this.sirenFilter);
    this.sirenFilter.connect(this.sirenGain);
    this.sirenGain.connect(this.masterGain);

    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  setSiren(active, intensity = 1.0) {
    if (!this.initialized || !this.sirenGain) return;
    this.resume();

    const t = this.ctx.currentTime;
    const targetVol = active ? Math.min(0.35, 0.15 * intensity) : 0;
    this.sirenGain.gain.setTargetAtTime(targetVol, t, 0.15);
  }

  // --- 3. Crash & Impact Sound ---
  playCrash(severity = 1.0) {
    if (!this.initialized || !this.ctx) return;
    this.resume();

    const t = this.ctx.currentTime;
    const dur = 0.35 + severity * 0.25;

    // Noise buffer
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800 * severity, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4 * severity, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
  }

  // --- 4. Punch & Combat Audio ---
  playPunch() {
    if (!this.initialized || !this.ctx) return;
    this.resume();

    const t = this.ctx.currentTime;
    // Swoosh noise + low thud
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  playImpact() {
    if (!this.initialized || !this.ctx) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.18);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  // --- 5. Mission Pickup / Success Chime ---
  playChime(type = 'pickup') {
    if (!this.initialized || !this.ctx) return;
    this.resume();

    const t = this.ctx.currentTime;
    const notes = type === 'success' ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 880.0]; // C5-E5-G5-C6 or E5-A5

    notes.forEach((freq, idx) => {
      const noteTime = t + idx * 0.11;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.28, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(noteTime);
      osc.stop(noteTime + 0.38);
    });
  }

  // --- 6. Light Ambient Synth Chords (Solmara Sunset Theme) ---
  startAmbientMusic() {
    if (!this.ctx) return;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.16; // Gentle background level
    this.ambientGain.connect(this.masterGain);

    // Warm chord progression: Fmaj7 (F3, A3, C4, E4) -> G (G3, B3, D4) -> Em7 (E3, G3, B3, D4) -> Am (A3, C4, E4)
    const chords = [
      [174.61, 220.0, 261.63, 329.63],
      [196.0, 246.94, 293.66],
      [164.81, 196.0, 246.94, 293.66],
      [220.0, 261.63, 329.63],
    ];

    const playChordStep = () => {
      if (!this.ctx || this.ctx.state === 'closed') return;
      const chord = chords[this.ambientStep % chords.length];
      this.ambientStep++;

      const t = this.ctx.currentTime;
      const chordDuration = 5.2;

      chord.forEach((freq) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(550, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.05, t + 1.2);
        gain.gain.linearRampToValueAtTime(0.035, t + 3.8);
        gain.gain.exponentialRampToValueAtTime(0.001, t + chordDuration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ambientGain);

        osc.start(t);
        osc.stop(t + chordDuration);
      });

      this.ambientTimer = setTimeout(playChordStep, (chordDuration - 0.4) * 1000);
    };

    playChordStep();
  }

  dispose() {
    if (this.ambientTimer) clearTimeout(this.ambientTimer);
    if (this.ctx) {
      this.ctx.close();
    }
  }
}
