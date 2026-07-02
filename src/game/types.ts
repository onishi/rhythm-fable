/** タイミング判定の種類 */
export type Judgment = 'perfect' | 'good' | 'miss';

/** 判定の表示ラベル(リズム天国風) */
export const JUDGMENT_LABEL: Record<Judgment, string> = {
  perfect: 'ピタッ!',
  good: 'まずまず',
  miss: 'あちゃー',
};
