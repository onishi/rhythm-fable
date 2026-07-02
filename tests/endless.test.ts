import { COUNT_IN_BEATS } from '../src/game/chart';
import {
  ENDLESS_BPM_STEP,
  ENDLESS_MAX_BPM,
  ENDLESS_MEASURES_PER_ROUND,
  ENDLESS_START_BPM,
  ROUND_LEAD_BEATS,
  buildEndlessRoundSpec,
  createEndlessRoundChart,
  mulberry32,
  roundBpm,
} from '../src/game/endless';
import { STAGES } from '../src/game/stages';

describe('mulberry32', () => {
  it('同じシードなら同じ列を返す(決定的)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 20; i++) {
      expect(a()).toBe(b());
    }
  });

  it('違うシードなら違う列になる', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 5 }, a);
    const seqB = Array.from({ length: 5 }, b);
    expect(seqA).not.toEqual(seqB);
  });

  it('値は [0, 1) の範囲', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('roundBpm', () => {
  it('ラウンド0は開始BPM', () => {
    expect(roundBpm(0)).toBe(ENDLESS_START_BPM);
  });

  it('ラウンドごとにSTEPずつ上がる', () => {
    expect(roundBpm(1)).toBe(ENDLESS_START_BPM + ENDLESS_BPM_STEP);
    expect(roundBpm(3)).toBe(ENDLESS_START_BPM + 3 * ENDLESS_BPM_STEP);
  });

  it('上限でキャップされる', () => {
    expect(roundBpm(100)).toBe(ENDLESS_MAX_BPM);
  });
});

describe('buildEndlessRoundSpec', () => {
  it('同じシードなら同じ譜面素材になる', () => {
    const a = buildEndlessRoundSpec(0, mulberry32(7));
    const b = buildEndlessRoundSpec(0, mulberry32(7));
    expect(a.stage.id).toBe(b.stage.id);
    expect(a.patterns).toEqual(b.patterns);
  });

  it('小節数は ENDLESS_MEASURES_PER_ROUND', () => {
    const spec = buildEndlessRoundSpec(0, mulberry32(1));
    expect(spec.patterns).toHaveLength(ENDLESS_MEASURES_PER_ROUND);
    expect(spec.stars).toHaveLength(ENDLESS_MEASURES_PER_ROUND);
    expect(spec.bombs).toHaveLength(ENDLESS_MEASURES_PER_ROUND);
  });

  it('選ばれたステージの連続した小節の切り出しになっている', () => {
    for (let seed = 0; seed < 10; seed++) {
      const spec = buildEndlessRoundSpec(0, mulberry32(seed));
      const source = spec.stage.patterns;
      // 連続区間として一致する開始位置が存在するはず
      const found = source.some((_, start) =>
        spec.patterns.every((p, i) => source[start + i] === p),
      );
      expect(found).toBe(true);
    }
  });

  it('stars/bombs も同じ区間から切り出される', () => {
    const spec = buildEndlessRoundSpec(0, mulberry32(3));
    const start = spec.stage.patterns.findIndex((p) => p === spec.patterns[0]);
    expect(spec.stars).toEqual(spec.stage.stars.slice(start, start + ENDLESS_MEASURES_PER_ROUND));
    expect(spec.bombs).toEqual(spec.stage.bombs.slice(start, start + ENDLESS_MEASURES_PER_ROUND));
  });

  it('BPMはラウンドに応じて上がる', () => {
    expect(buildEndlessRoundSpec(0, mulberry32(1)).bpm).toBe(roundBpm(0));
    expect(buildEndlessRoundSpec(5, mulberry32(1)).bpm).toBe(roundBpm(5));
  });

  it('全ステージが8小節以上ある(切り出し可能)', () => {
    for (const stage of STAGES) {
      expect(stage.patterns.length).toBeGreaterThanOrEqual(ENDLESS_MEASURES_PER_ROUND);
    }
  });

  it('コール&レスポンス型のステージは素材に選ばれない', () => {
    for (let seed = 0; seed < 50; seed++) {
      const spec = buildEndlessRoundSpec(0, mulberry32(seed));
      expect(spec.stage.gameSystem ?? 'flow').toBe('flow');
    }
  });

  it('逆走ステージは素材に選ばれない(途中で向きが変わると不公平)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const spec = buildEndlessRoundSpec(0, mulberry32(seed));
      expect(spec.stage.reverse ?? false).toBe(false);
    }
  });
});

describe('createEndlessRoundChart', () => {
  it('最初のラウンドはカウントイン4拍のあと始まる', () => {
    const spec = buildEndlessRoundSpec(0, mulberry32(1));
    const chart = createEndlessRoundChart(spec, 0);
    expect(chart.notes[0].beat).toBeGreaterThanOrEqual(COUNT_IN_BEATS);
  });

  it('2ラウンド目以降は助走2拍で始まる', () => {
    const spec = buildEndlessRoundSpec(1, mulberry32(1));
    const chart = createEndlessRoundChart(spec, 1);
    expect(chart.notes[0].beat).toBeGreaterThanOrEqual(ROUND_LEAD_BEATS);
    expect(chart.notes[0].beat).toBeLessThan(COUNT_IN_BEATS + 4);
  });

  it('チャートのBPMはスペックと一致する', () => {
    const spec = buildEndlessRoundSpec(2, mulberry32(9));
    expect(createEndlessRoundChart(spec, 2).bpm).toBe(spec.bpm);
  });

  it('ノーツ数はパターン+ボムの合計', () => {
    const spec = buildEndlessRoundSpec(0, mulberry32(5));
    const expected =
      spec.patterns.reduce((sum, m) => sum + m.length, 0) +
      spec.bombs.reduce((sum, m) => sum + m.length, 0);
    expect(createEndlessRoundChart(spec, 0).notes).toHaveLength(expected);
  });
});
