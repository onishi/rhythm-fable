import type { Judgment, NoteKind } from './types';

export interface ScoreState {
  score: number;
  combo: number;
  maxCombo: number;
  counts: Record<Judgment, number>;
}

/** 判定ごとの基礎点 */
export const BASE_SCORE: Record<Judgment, number> = {
  perfect: 100,
  good: 50,
  miss: 0,
};

/** スターノーツの得点倍率 */
export const STAR_MULTIPLIER = 2;

/** フィーバー突入に必要なコンボ数 */
export const FEVER_COMBO = 10;

/** フィーバー中の得点倍率 */
export const FEVER_MULTIPLIER = 2;

/** コンボによる加点(上限あり) */
export const COMBO_BONUS_CAP = 50;

/** フィーバー中か(このコンボ数の状態で次を叩くと倍率がかかる) */
export function isFever(combo: number): boolean {
  return combo >= FEVER_COMBO;
}

export function createScoreState(): ScoreState {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    counts: { perfect: 0, good: 0, miss: 0 },
  };
}

/** 継続コンボ数に応じたボーナス点 */
export function comboBonus(combo: number): number {
  return Math.min(Math.max(combo, 0), COMBO_BONUS_CAP);
}

/** 判定を適用した新しいスコア状態を返す(元の状態は変更しない) */
export function applyJudgment(
  state: ScoreState,
  judgment: Judgment,
  kind: NoteKind = 'normal',
): ScoreState {
  const combo = judgment === 'miss' ? 0 : state.combo + 1;
  const base =
    BASE_SCORE[judgment] *
    (kind === 'star' ? STAR_MULTIPLIER : 1) *
    (isFever(state.combo) ? FEVER_MULTIPLIER : 1);
  return {
    score: state.score + base + (judgment === 'miss' ? 0 : comboBonus(combo)),
    combo,
    maxCombo: Math.max(state.maxCombo, combo),
    counts: { ...state.counts, [judgment]: state.counts[judgment] + 1 },
  };
}

export type Rank = 'high' | 'ok' | 'retry';

/** リズム天国風の評価ラベル */
export const RANK_LABEL: Record<Rank, string> = {
  high: 'ハイレベル!',
  ok: 'まずまず',
  retry: 'やりなおし…',
};

/** perfect=1.0, good=0.5 として精度(0〜1)を計算する */
export function calcAccuracy(counts: Record<Judgment, number>): number {
  const total = counts.perfect + counts.good + counts.miss;
  if (total === 0) return 0;
  return (counts.perfect + counts.good * 0.5) / total;
}

/** 精度から評価を決める */
export function calcRank(accuracy: number): Rank {
  if (accuracy >= 0.85) return 'high';
  if (accuracy >= 0.6) return 'ok';
  return 'retry';
}

/** 全ノーツ「ピタッ!」ならパーフェクト */
export function isPerfectPlay(counts: Record<Judgment, number>): boolean {
  return counts.perfect > 0 && counts.good === 0 && counts.miss === 0;
}
