import type { Judgment } from './types';
import type { Rank } from './score';

/**
 * Web Audio API でゲーム音をすべて合成するプレイヤー。
 * 音源ファイルを使わないのでロード不要。
 */
export class GameAudio {
  private ctx: AudioContext | null = null;

  ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  get currentTime(): number {
    return this.ensure().currentTime;
  }

  /** 単音を指定時刻に鳴らす */
  private tone(
    time: number,
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ): void {
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + duration);
  }

  /** メトロノーム音。accent は小節頭 */
  playTick(time: number, accent: boolean): void {
    this.tone(time, accent ? 1760 : 880, 0.06, 'square', accent ? 0.12 : 0.07);
  }

  /** 判定音(即時再生) */
  playHit(judgment: Judgment): void {
    const now = this.currentTime;
    if (judgment === 'perfect') {
      this.tone(now, 880, 0.1, 'triangle', 0.25);
      this.tone(now + 0.07, 1320, 0.18, 'triangle', 0.25);
    } else if (judgment === 'good') {
      this.tone(now, 660, 0.12, 'triangle', 0.2);
    } else {
      this.tone(now, 110, 0.25, 'sawtooth', 0.18);
    }
  }

  /** リザルトのジングル */
  playResultJingle(rank: Rank): void {
    const now = this.currentTime + 0.1;
    const step = 0.16;
    const melodies: Record<Rank, number[]> = {
      high: [523, 659, 784, 1047, 1319],
      ok: [523, 587, 659],
      retry: [330, 294, 262],
    };
    melodies[rank].forEach((freq, i) => {
      this.tone(now + i * step, freq, 0.3, 'triangle', 0.22);
    });
  }
}
