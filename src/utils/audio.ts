/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Custom Synthesizer using Web Audio API to avoid requiring external asset loading
class SoundSynthesizer {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx) {
      if (typeof window !== "undefined") {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
    }
    // Resume if suspended (browsers protect auto-play)
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  /**
   * Sound "Teet" - High pitch success beep
   */
  public playSuccess() {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1100, this.ctx.currentTime); // 1100 Hz "Teet"

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15); // fade out

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch (e) {
      console.warn("Failed to play success sound", e);
    }
  }

  /**
   * Sound "Bzzzt" - Low dual-tone buzzer for duplicate or scanner error
   */
  public playError() {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      
      // We will combine two detuned square/sawtooth waves to make a classic buzzer sounds
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(120, now);
      
      osc2.type = "sawtooth";
      osc2.frequency.setValueAtTime(125, now); // slightly detuned for chorus grit

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45); // longer vibration

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(now + 0.45);
      osc2.stop(now + 0.45);
    } catch (e) {
      console.warn("Failed to play error sound", e);
    }
  }
}

export const audioService = new SoundSynthesizer();
