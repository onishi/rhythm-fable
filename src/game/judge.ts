import type { Judgment } from './types';

/** ピタッ! と判定される許容誤差(秒) */
export const PERFECT_WINDOW = 0.05;
/** まずまず と判定される許容誤差(秒) */
export const GOOD_WINDOW = 0.11;
/** これを超えた入力はノーツを消費しない(秒) */
export const MISS_WINDOW = 0.2;

/** ノーツの最終状態。avoided はおじゃまノーツを叩かずにやり過ごした状態 */
export type NoteResult = Judgment | 'avoided';

/**
 * 入力とノーツの時間差から判定を返す。
 * MISS_WINDOW より外の入力は対象ノーツなしとして null を返す。
 */
export function judgeOffset(offsetSec: number): Judgment | null {
  const abs = Math.abs(offsetSec);
  if (abs <= PERFECT_WINDOW) return 'perfect';
  if (abs <= GOOD_WINDOW) return 'good';
  if (abs <= MISS_WINDOW) return 'miss';
  return null;
}

/**
 * 入力時刻に最も近い未判定ノーツの添字を返す。
 * MISS_WINDOW 内に候補がなければ -1。
 */
export function findTargetNoteIndex(
  noteTimes: readonly number[],
  judged: readonly (NoteResult | null)[],
  inputTime: number,
): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < noteTimes.length; i++) {
    if (judged[i] !== null) continue;
    const dist = Math.abs(noteTimes[i] - inputTime);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return bestDist <= MISS_WINDOW ? best : -1;
}
