import {
  GOOD_WINDOW,
  MISS_WINDOW,
  PERFECT_WINDOW,
  findTargetNoteIndex,
  judgeOffset,
} from '../src/game/judge';
import type { NoteResult } from '../src/game/judge';
import type { Judgment } from '../src/game/types';

describe('judgeOffset', () => {
  it('ぴったりの入力は perfect', () => {
    expect(judgeOffset(0)).toBe('perfect');
  });

  it('PERFECT_WINDOW の境界は perfect(早入力・遅入力とも)', () => {
    expect(judgeOffset(PERFECT_WINDOW)).toBe('perfect');
    expect(judgeOffset(-PERFECT_WINDOW)).toBe('perfect');
  });

  it('PERFECT_WINDOW を超えて GOOD_WINDOW 以内は good', () => {
    expect(judgeOffset(PERFECT_WINDOW + 0.001)).toBe('good');
    expect(judgeOffset(-GOOD_WINDOW)).toBe('good');
  });

  it('GOOD_WINDOW を超えて MISS_WINDOW 以内は miss', () => {
    expect(judgeOffset(GOOD_WINDOW + 0.001)).toBe('miss');
    expect(judgeOffset(-MISS_WINDOW)).toBe('miss');
  });

  it('MISS_WINDOW より外は null(判定対象外)', () => {
    expect(judgeOffset(MISS_WINDOW + 0.001)).toBeNull();
    expect(judgeOffset(-1)).toBeNull();
  });
});

describe('findTargetNoteIndex', () => {
  const times = [1.0, 2.0, 3.0];
  const noneJudged: (Judgment | null)[] = [null, null, null];

  it('最も近い未判定ノーツを返す', () => {
    expect(findTargetNoteIndex(times, noneJudged, 2.05)).toBe(1);
  });

  it('判定済みノーツはスキップする', () => {
    const judged: (Judgment | null)[] = [null, 'perfect', null];
    expect(findTargetNoteIndex(times, judged, 2.05)).toBe(-1);
  });

  it('MISS_WINDOW 内に候補がなければ -1', () => {
    expect(findTargetNoteIndex(times, noneJudged, 1.5)).toBe(-1);
  });

  it('MISS_WINDOW ちょうどの距離は対象になる', () => {
    expect(findTargetNoteIndex(times, noneJudged, 1.0 + MISS_WINDOW)).toBe(0);
  });

  it('ノーツが空なら -1', () => {
    expect(findTargetNoteIndex([], [], 1.0)).toBe(-1);
  });

  it('全ノーツ判定済みなら -1', () => {
    const judged: (Judgment | null)[] = ['perfect', 'good', 'miss'];
    expect(findTargetNoteIndex(times, judged, 2.0)).toBe(-1);
  });

  it('回避済み(avoided)のおじゃまノーツもスキップする', () => {
    const judged: (NoteResult | null)[] = [null, 'avoided', null];
    expect(findTargetNoteIndex(times, judged, 2.05)).toBe(-1);
  });
});
