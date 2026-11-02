// Procedural Web Audio Ambient Synthesizer for Fullscreen Timer (Rain & Campfire)
class AmbientAudioController {
  private ctx: AudioContext | null = null;
  private currentMode: 'rain' | 'fire' | 'off' = 'off';
  private masterGain: GainNode | null = null;
  private activeNodes: (AudioNode | number)[] = [];

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playRain(volume = 0.3) {
    this.stop();
    this.initContext();
    if (!this.ctx) return;

    this.currentMode = 'rain';
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(volume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Buffer-based continuous pink noise for steady rainfall
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Filter to sound like natural soft raindrops
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(this.masterGain);
    whiteNoise.start();

    this.activeNodes.push(whiteNoise, filter);
  }

  playCampfire(volume = 0.35) {
    this.stop();
    this.initContext();
    if (!this.ctx) return;

    this.currentMode = 'fire';
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(volume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // 1. Low warm rumble
    const rumbleOsc = this.ctx.createOscillator();
    const rumbleGain = this.ctx.createGain();
    rumbleOsc.type = 'sine';
    rumbleOsc.frequency.setValueAtTime(80, this.ctx.currentTime);
    rumbleGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    rumbleOsc.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);
    rumbleOsc.start();
    this.activeNodes.push(rumbleOsc, rumbleGain);

    // 2. Periodic procedural wood crackles
    const intervalId = window.setInterval(() => {
      if (!this.ctx || this.currentMode !== 'fire' || !this.masterGain) return;
      if (Math.random() > 0.4) {
        const crackle = this.ctx.createOscillator();
        const crackleGain = this.ctx.createGain();
        crackle.type = 'triangle';
        crackle.frequency.setValueAtTime(600 + Math.random() * 1200, this.ctx.currentTime);

        const now = this.ctx.currentTime;
        crackleGain.gain.setValueAtTime(0.08 + Math.random() * 0.15, now);
        crackleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05 + Math.random() * 0.08);

        crackle.connect(crackleGain);
        crackleGain.connect(this.masterGain);
        crackle.start(now);
        crackle.stop(now + 0.15);
      }
    }, 120);

    this.activeNodes.push(intervalId);
  }

  stop() {
    this.currentMode = 'off';
    this.activeNodes.forEach((node) => {
      if (typeof node === 'number') {
        clearInterval(node);
      } else {
        try {
          if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
            (node as AudioScheduledSourceNode).stop();
          }
          node.disconnect();
        } catch {
          // ignore
        }
      }
    });
    this.activeNodes = [];
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
  }

  getMode() {
    return this.currentMode;
  }
}

export const ambientAudio = new AmbientAudioController();
