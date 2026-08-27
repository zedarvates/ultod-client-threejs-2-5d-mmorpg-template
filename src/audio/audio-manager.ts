// SPDX-License-Identifier: MIT
// Fail-closed Audio Manager for 2.5D client MMORPG.

export type SoundEffectName =
  | "ui_confirm"
  | "ui_cancel"
  | "ui_click"
  | "ui_dialog_open"
  | "sword_swing"
  | "impact_hit"
  | "coins"
  | "beast_roar"
  | "victory_fanfare";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private masterGain: GainNode | null = null;
  private unlocked = false;

  constructor(private readonly baseUrl: string = "") {}

  /** Unlocks audio context on user gesture (browser policy). */
  unlock(): void {
    if (this.unlocked) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.unlocked = true;
      }
    } catch {
      // Audio context disabled or unavailable in environment
      this.ctx = null;
    }
  }

  /** Plays a sound effect by name fail-closed (no crash if audio unavailable or file absent). */
  async play(sfxName: SoundEffectName, volume = 1.0): Promise<void> {
    if (!this.unlocked || !this.ctx || !this.masterGain) return;

    try {
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }

      let buffer = this.buffers.get(sfxName);
      if (!buffer) {
        const url = this.baseUrl + "audio/basic-audio/SFX/" + sfxName + ".wav";
        const res = await fetch(url);
        if (!res.ok) return; // fail closed
        const arrayBuf = await res.arrayBuffer();
        buffer = await this.ctx.decodeAudioData(arrayBuf);
        this.buffers.set(sfxName, buffer);
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      const gain = this.ctx.createGain();
      gain.gain.value = Math.max(0, Math.min(1, volume));
      source.connect(gain);
      gain.connect(this.masterGain);

      source.start(0);
    } catch (err) {
      console.warn("[audio-manager] failed to play " + sfxName, err);
    }
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }
}
