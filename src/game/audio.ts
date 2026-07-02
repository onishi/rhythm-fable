import type { Judgment } from './types';
import type { Rank } from './score';
import { midiToFreq, type MusicEvent } from './music';

/**
 * Web Audio API でゲーム音をすべて合成するプレイヤー。
 * 音源ファイルを使わないのでロード不要。
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;

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

  /** ホワイトノイズをハイパスに通して鳴らす(スネア・ハイハット用) */
  private noise(time: number, duration: number, volume: number, cutoff: number): void {
    const ctx = this.ensure();
    if (!this.noiseBuffer) {
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.3), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(cutoff, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(time);
    source.stop(time + duration);
  }

  /** ピッチが落ちるキック */
  private kick(time: number): void {
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.1);
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  /** 伴奏イベントを絶対時刻(オーディオクロック)で予約する */
  playMusicEvent(event: MusicEvent, absTime: number): void {
    switch (event.kind) {
      case 'count':
        this.tone(absTime, 1320, 0.05, 'square', 0.12);
        break;
      case 'kick':
        this.kick(absTime);
        break;
      case 'snare':
        this.noise(absTime, 0.12, 0.2, 1800);
        break;
      case 'hat':
        this.noise(absTime, 0.04, 0.06, 7000);
        break;
      case 'bass':
        if (event.midi !== undefined) {
          this.tone(absTime, midiToFreq(event.midi), 0.3, 'triangle', 0.25);
        }
        break;
      case 'melody':
        if (event.midi !== undefined) {
          this.tone(absTime, midiToFreq(event.midi), 0.22, 'square', 0.09);
        }
        break;
    }
  }

  /** 判定音(即時再生)。スターノーツは1オクターブ上でキラッと鳴る */
  playHit(judgment: Judgment, star = false): void {
    const now = this.currentTime;
    const mul = star ? 2 : 1;
    if (judgment === 'perfect') {
      this.tone(now, 880 * mul, 0.1, 'triangle', 0.25);
      this.tone(now + 0.07, 1320 * mul, 0.18, 'triangle', 0.25);
      if (star) {
        this.tone(now + 0.14, 2093, 0.25, 'triangle', 0.2);
      }
    } else if (judgment === 'good') {
      this.tone(now, 660 * mul, 0.12, 'triangle', 0.2);
    } else {
      this.tone(now, 110, 0.25, 'sawtooth', 0.18);
    }
  }

  /** ノーツがないところで叩いたときの空振り音 */
  playEmptyTap(): void {
    this.tone(this.currentTime, 300, 0.05, 'sine', 0.07);
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
