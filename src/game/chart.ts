import type { NoteKind } from './types';

export interface Note {
  id: number;
  /** 曲頭からの拍数 */
  beat: number;
  /** 曲頭からの秒数 */
  time: number;
  kind: NoteKind;
}

export interface Chart {
  bpm: number;
  /** カウントイン込みの総拍数(伴奏の再生用) */
  totalBeats: number;
  notes: Note[];
  /** ゲーム終了までの秒数 */
  lengthSec: number;
}

/** 1小節の拍数 */
export const BEATS_PER_MEASURE = 4;
/** 演奏開始前のカウントイン拍数 */
export const COUNT_IN_BEATS = 4;

/** 拍数を秒数に変換する */
export function beatToTime(beat: number, bpm: number): number {
  return (beat * 60) / bpm;
}

/**
 * 小節ごとのパターン(小節内の拍位置の配列)を、
 * startBeat から始まる通し拍数の列に展開する。
 */
export function buildBeats(
  patterns: readonly (readonly number[])[],
  startBeat = 0,
  beatsPerMeasure = BEATS_PER_MEASURE,
): number[] {
  const beats: number[] = [];
  patterns.forEach((pattern, measure) => {
    for (const offset of pattern) {
      beats.push(startBeat + measure * beatsPerMeasure + offset);
    }
  });
  return beats;
}

/**
 * 拍数の列から譜面を生成する。
 * - starBeats に含まれる拍のノーツはスターノーツ(得点2倍)
 * - bombBeats は beats とは別に追加される「叩いてはいけない」おじゃまノーツ
 */
export function createChart(
  bpm: number,
  beats: readonly number[],
  starBeats: readonly number[] = [],
  bombBeats: readonly number[] = [],
): Chart {
  const starSet = new Set(starBeats);
  const entries = [
    ...beats.map((beat) => ({ beat, bomb: false })),
    ...bombBeats.map((beat) => ({ beat, bomb: true })),
  ].sort((a, b) => a.beat - b.beat);
  const notes: Note[] = entries.map((entry, id) => ({
    id,
    beat: entry.beat,
    time: beatToTime(entry.beat, bpm),
    kind: entry.bomb ? 'bomb' : starSet.has(entry.beat) ? 'star' : 'normal',
  }));
  const lastBeat = entries.length > 0 ? entries[entries.length - 1].beat : 0;
  const endBeat = Math.ceil(lastBeat) + BEATS_PER_MEASURE;
  return {
    bpm,
    totalBeats: endBeat,
    notes,
    lengthSec: beatToTime(endBeat, bpm),
  };
}
