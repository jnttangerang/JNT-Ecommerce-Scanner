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

  /**
   * Safe Indonesian text-to-speech announcer
   */
  public speak(text: string) {
    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "id-ID"; // Indonesian
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn("Speech synthesis failed:", e);
    }
  }

  /**
   * Sound alert for CANCELLED resi scan (Alarm/Siren wave + text-to-speech)
   */
  public playCancelled() {
    try {
      this.initCtx();
      if (!this.ctx) {
        this.speak("Resi Batal!");
        return;
      }

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      // Siren sound: sweep frequency up and down rapidly
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.2);
      osc.frequency.linearRampToValueAtTime(300, now + 0.4);
      osc.frequency.linearRampToValueAtTime(700, now + 0.6);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(now + 0.7);

      // Speak after sound plays slightly
      setTimeout(() => {
        this.speak("Peringatan! Resi Batal!");
      }, 50);
    } catch (e) {
      console.warn("Failed to play cancelled sound", e);
      this.speak("Resi Batal!");
    }
  }

  /**
   * Sound alert for Retake instructions (Two-tone high chirp + text-to-speech)
   */
  public playRetake() {
    try {
      this.initCtx();
      if (!this.ctx) {
        this.speak("Foto Ulang!");
        return;
      }

      const now = this.ctx.currentTime;
      
      // Tone 1
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now); // A5
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start();
      osc1.stop(now + 0.15);

      // Tone 2
      setTimeout(() => {
        if (!this.ctx) return;
        const now2 = this.ctx.currentTime;
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(1320, now2); // E6 high chirp
        gain2.gain.setValueAtTime(0.3, now2);
        gain2.gain.exponentialRampToValueAtTime(0.01, now2 + 0.2);
        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);
        osc2.start();
        osc2.stop(now2 + 0.2);
      }, 120);

      // Speak text
      setTimeout(() => {
        this.speak("Foto ulang resi ini!");
      }, 350);
    } catch (e) {
      console.warn("Failed to play retake sound", e);
      this.speak("Foto Ulang!");
    }
  }
}

export const audioService = new SoundSynthesizer();
