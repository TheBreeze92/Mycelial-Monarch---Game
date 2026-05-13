/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicLayers: { osc: OscillatorNode, gain: GainNode, filter: BiquadFilterNode }[] = [];
  private sequenceInterval: number | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  constructor() {}

  private init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.5;
    this.isInitialized = true;
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx!.currentTime, 0.1);
    }
  }

  public startDrone(isShock: boolean = false) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    this.stopDrone();

    // 1. SUB-BASS (Depth)
    this.createLayer(isShock ? 55 : 41.2, 'sine', 0.15, 200, 2); 

    // 2. MUSICAL PADS (Harmonics)
    const chords = isShock ? [110, 130.81, 164.81] : [82.41, 98, 123.47];
    chords.forEach((freq, i) => {
      this.createLayer(freq, 'triangle', 0.05, 400 + (i * 100), 4 + i);
    });

    // 3. TEXTURE (Movement)
    this.createLayer(isShock ? 220 : 164.81, isShock ? 'sawtooth' : 'sine', 0.03, 1000, 8, true);

    // 4. RANDOM MELODY BLOOMS
    this.startMelody(isShock);
  }

  private createLayer(freq: number, type: OscillatorType, volume: number, cutoff: number, lfoRate: number, isRhythmic: boolean = false) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = Math.random() * 10 - 5;

    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    filter.Q.value = isRhythmic ? 15 : 5;

    lfo.frequency.value = 1 / lfoRate;
    lfoGain.gain.value = cutoff * 0.5;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    gain.gain.value = 0;
    gain.gain.setTargetAtTime(volume, this.ctx.currentTime, 3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    lfo.start();

    this.musicLayers.push({ osc, gain, filter });
  }

  private startMelody(isShock: boolean) {
    const notes = isShock ? [440, 466.16, 523.25, 659.25] : [329.63, 392, 440, 493.88];
    
    this.sequenceInterval = window.setInterval(() => {
      if (Math.random() > 0.7 && !this.isMuted) {
        const freq = notes[Math.floor(Math.random() * notes.length)];
        this.playSoftNote(freq);
      }
    }, 2000);
  }

  private playSoftNote(freq: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;
    
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 1);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 4);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 4);
  }

  public stopDrone() {
    this.musicLayers.forEach(l => {
      try { 
        l.gain.gain.setTargetAtTime(0, this.ctx!.currentTime, 1);
        setTimeout(() => {
          try { l.osc.stop(); } catch(e) {}
        }, 1000);
      } catch(e) {}
    });
    this.musicLayers = [];
    if (this.sequenceInterval) {
      clearInterval(this.sequenceInterval);
      this.sequenceInterval = null;
    }
  }

  public playClick() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  public playUpgrade() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  public playShock() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const noise = this.ctx.createBufferSource();
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    noise.start();
  }

  public playAchievement() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const notes = [440, 554.37, 659.25, 880]; // A Major arpeggio
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + (i * 0.1));
      
      gain.gain.setValueAtTime(0, this.ctx!.currentTime + (i * 0.1));
      gain.gain.linearRampToValueAtTime(0.1, this.ctx!.currentTime + (i * 0.1) + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + (i * 0.1) + 0.3);
      
      osc.connect(gain);
      gain.connect(this.masterGain!);
      
      osc.start(this.ctx!.currentTime + (i * 0.1));
      osc.stop(this.ctx!.currentTime + (i * 0.1) + 0.3);
    });
  }
}

export const audioService = new AudioService();
