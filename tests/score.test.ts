import {
  BASE_SCORE,
  COMBO_BONUS_CAP,
  RANK_LABEL,
  applyJudgment,
  calcAccuracy,
  calcRank,
  comboBonus,
  createScoreState,
} from '../src/game/score';

describe('createScoreState', () => {
  it('すべて0で初期化される', () => {
    expect(createScoreState()).toEqual({
      score: 0,
      combo: 0,
      maxCombo: 0,
      counts: { perfect: 0, good: 0, miss: 0 },
    });
  });
});

describe('comboBonus', () => {
  it('コンボ数と同じボーナスを返す', () => {
    expect(comboBonus(1)).toBe(1);
    expect(comboBonus(30)).toBe(30);
  });

  it('上限でキャップされる', () => {
    expect(comboBonus(COMBO_BONUS_CAP + 100)).toBe(COMBO_BONUS_CAP);
  });

  it('負の値は0になる', () => {
    expect(comboBonus(-5)).toBe(0);
  });
});

describe('applyJudgment', () => {
  it('perfect で基礎点+コンボボーナスが加算されコンボが伸びる', () => {
    const state = applyJudgment(createScoreState(), 'perfect');
    expect(state.score).toBe(BASE_SCORE.perfect + comboBonus(1));
    expect(state.combo).toBe(1);
    expect(state.maxCombo).toBe(1);
    expect(state.counts.perfect).toBe(1);
  });

  it('good でもコンボは継続する', () => {
    let state = applyJudgment(createScoreState(), 'perfect');
    state = applyJudgment(state, 'good');
    expect(state.combo).toBe(2);
    expect(state.counts.good).toBe(1);
  });

  it('miss でコンボが0に戻るが maxCombo は保持される', () => {
    let state = createScoreState();
    state = applyJudgment(state, 'perfect');
    state = applyJudgment(state, 'perfect');
    state = applyJudgment(state, 'miss');
    expect(state.combo).toBe(0);
    expect(state.maxCombo).toBe(2);
    expect(state.counts.miss).toBe(1);
  });

  it('miss では得点が増えない', () => {
    const before = applyJudgment(createScoreState(), 'perfect');
    const after = applyJudgment(before, 'miss');
    expect(after.score).toBe(before.score);
  });

  it('元の状態を変更しない(イミュータブル)', () => {
    const original = createScoreState();
    applyJudgment(original, 'perfect');
    expect(original.score).toBe(0);
    expect(original.counts.perfect).toBe(0);
  });
});

describe('calcAccuracy', () => {
  it('全perfectで1.0', () => {
    expect(calcAccuracy({ perfect: 10, good: 0, miss: 0 })).toBe(1);
  });

  it('goodは0.5換算', () => {
    expect(calcAccuracy({ perfect: 0, good: 10, miss: 0 })).toBe(0.5);
  });

  it('全missで0', () => {
    expect(calcAccuracy({ perfect: 0, good: 0, miss: 10 })).toBe(0);
  });

  it('ノーツ0件なら0(ゼロ除算しない)', () => {
    expect(calcAccuracy({ perfect: 0, good: 0, miss: 0 })).toBe(0);
  });

  it('混在時は加重平均になる', () => {
    // perfect 2 + good 1(0.5) = 2.5 / 4
    expect(calcAccuracy({ perfect: 2, good: 1, miss: 1 })).toBeCloseTo(0.625);
  });
});

describe('calcRank', () => {
  it('0.85以上は high', () => {
    expect(calcRank(0.85)).toBe('high');
    expect(calcRank(1)).toBe('high');
  });

  it('0.6以上0.85未満は ok', () => {
    expect(calcRank(0.6)).toBe('ok');
    expect(calcRank(0.849)).toBe('ok');
  });

  it('0.6未満は retry', () => {
    expect(calcRank(0.599)).toBe('retry');
    expect(calcRank(0)).toBe('retry');
  });
});

describe('RANK_LABEL', () => {
  it('全ランクに日本語ラベルがある', () => {
    expect(RANK_LABEL.high).toBe('ハイレベル!');
    expect(RANK_LABEL.ok).toBe('まずまず');
    expect(RANK_LABEL.retry).toBe('やりなおし…');
  });
});
