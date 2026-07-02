/** タイミング判定の種類 */
export type Judgment = 'perfect' | 'good' | 'miss';

/** ノーツの種類(star は得点2倍、bomb は叩いてはいけない) */
export type NoteKind = 'normal' | 'star' | 'bomb';

/** 判定の表示ラベル(リズム天国風) */
export const JUDGMENT_LABEL: Record<Judgment, string> = {
  perfect: 'ピタッ!',
  good: 'まずまず',
  miss: 'あちゃー',
};
