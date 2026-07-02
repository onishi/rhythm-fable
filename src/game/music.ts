import {
  BEATS_PER_MEASURE,
  COUNT_IN_BEATS,
  beatToTime,
  type Chart,
} from './chart';

/** ステージごとの伴奏設定 */
export interface StageMusic {
  /** 小節ごとのベース音(MIDIノート番号)。長さぶんでループする */
  bassRoots: readonly number[];
  /** メロディに使う音階(MIDIノート番号) */
  scale: readonly number[];
}

export type MusicEventKind = 'count' | 'kick' | 'snare' | 'hat' | 'bass' | 'melody';

export interface MusicEvent {
  /** 曲頭からの秒数 */
  time: number;
  kind: MusicEventKind;
  /** bass / melody の音高 */
  midi?: number;
}

/** MIDIノート番号を周波数(Hz)に変換する (A4=69=440Hz) */
export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * 譜面と伴奏設定から、再生する音のイベント列(時間昇順)を生成する。
 * - カウントイン: クリック音のみ
 * - ドラム: 表拍にキック/スネア交互、8分裏にハイハット
 * - ベース: 小節内の1・3拍目にコードルート
 * - メロディ: 各ノーツの拍に音階から決定的に選んだ音
 */
export function buildMusicEvents(chart: Chart, music: StageMusic): MusicEvent[] {
  const { bpm, totalBeats, notes } = chart;
  const events: MusicEvent[] = [];

  for (let beat = 0; beat < totalBeats; beat++) {
    if (beat < COUNT_IN_BEATS) {
      events.push({ time: beatToTime(beat, bpm), kind: 'count' });
      continue;
    }
    const inMeasure = (beat - COUNT_IN_BEATS) % BEATS_PER_MEASURE;
    events.push({
      time: beatToTime(beat, bpm),
      kind: inMeasure % 2 === 0 ? 'kick' : 'snare',
    });
    events.push({ time: beatToTime(beat + 0.5, bpm), kind: 'hat' });
    if (inMeasure % 2 === 0) {
      const measure = Math.floor((beat - COUNT_IN_BEATS) / BEATS_PER_MEASURE);
      events.push({
        time: beatToTime(beat, bpm),
        kind: 'bass',
        midi: music.bassRoots[measure % music.bassRoots.length],
      });
    }
  }

  notes.forEach((note, index) => {
    const degree = (index * 2 + Math.floor(note.beat)) % music.scale.length;
    events.push({ time: note.time, kind: 'melody', midi: music.scale[degree] });
  });

  return events.sort((a, b) => a.time - b.time);
}
