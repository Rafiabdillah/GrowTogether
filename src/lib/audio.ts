// Web Audio API procedural synthesis for gentle zen chimes and celebration tones
class SoundController {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Gentle rewarding bell for habit completion
  playHabitComplete() {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // Harmonic chord: F5 (698.46 Hz) to A5 (880 Hz)
      osc.frequency.setValueAtTime(698.46, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.6);
    } catch {
      // Audio context might be restricted before user gesture
    }
  }

  // Meditative singing bowl chime for focus session finish
  playSessionChime() {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const freqs = [528, 792, 1056]; // 528Hz Solfeggio "love & transformation" frequency
      freqs.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const initialVol = 0.12 / (idx + 1);
        gain.gain.setValueAtTime(initialVol, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 2.5);
      });
    } catch {
      // ignore
    }
  }

  // Alias for playSessionChime
  playFocusChime() {
    this.playSessionChime();
  }

  // Harmonic chord for couple high-five celebration and pairing
  playHighFive() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        gain.gain.setValueAtTime(0.12, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.8);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.8);
      });
    } catch {
      // ignore
    }
  }

  // Soft click / reaction send tone
  playReactionSent() {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch {
      // ignore
    }
  }

  private tone(freq: number, startAt: number, length: number, volume: number, type: OscillatorType = 'sine') {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startAt);
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime + startAt);
    gain.gain.exponentialRampToValueAtTime(volume, this.ctx.currentTime + startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + startAt + length);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(this.ctx.currentTime + startAt);
    osc.stop(this.ctx.currentTime + startAt + length + 0.02);
  }

  // Pelukan yang dilepas: naik dan berdentang, supaya mengirim terasa memberi.
  playHugBurst() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      this.tone(523.25, 0, 0.18, 0.12, 'triangle');
      this.tone(659.25, 0.08, 0.2, 0.12, 'triangle');
      this.tone(783.99, 0.17, 0.32, 0.1, 'sine');
    } catch {
      // ignore
    }
  }

  // Pelukan yang datang: dua nada pendek yang terdengar seperti dipanggil.
  playHugReceived() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      this.tone(880, 0, 0.14, 0.1, 'sine');
      this.tone(1174.66, 0.12, 0.3, 0.09, 'sine');
    } catch {
      // ignore
    }
  }

  playReactionReceived() {
    this.playHugReceived();
  }
}

export const sound = new SoundController();
