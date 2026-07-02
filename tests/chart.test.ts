import {
  BEATS_PER_MEASURE,
  COUNT_IN_BEATS,
  FABLE_BPM,
  FABLE_PATTERNS,
  beatToTime,
  buildBeats,
  createChart,
  createFableChart,
} from '../src/game/chart';

describe('beatToTime', () => {
  it('BPM120では1拍=0.5秒', () => {
    expect(beatToTime(1, 120)).toBe(0.5);
    expect(beatToTime(4, 120)).toBe(2);
  });

  it('BPM60では1拍=1秒', () => {
    expect(beatToTime(3, 60)).toBe(3);
  });
});

describe('buildBeats', () => {
  it('小節パターンを通し拍数に展開する', () => {
    expect(buildBeats([[0, 2], [1]])).toEqual([0, 2, 5]);
  });

  it('startBeat 分だけずれる', () => {
    expect(buildBeats([[0, 2]], 4)).toEqual([4, 6]);
  });

  it('8分裏(小数拍)も扱える', () => {
    expect(buildBeats([[0, 1.5]])).toEqual([0, 1.5]);
  });

  it('空パターンの小節は休みになる', () => {
    expect(buildBeats([[0], [], [0]])).toEqual([0, 8]);
  });
});

describe('createChart', () => {
  it('ノーツが時間昇順に並びIDが連番になる', () => {
    const chart = createChart(120, [4, 0, 2]);
    expect(chart.notes.map((n) => n.beat)).toEqual([0, 2, 4]);
    expect(chart.notes.map((n) => n.id)).toEqual([0, 1, 2]);
  });

  it('各ノーツの time は beatToTime と一致する', () => {
    const chart = createChart(150, [0, 1, 3]);
    for (const note of chart.notes) {
      expect(note.time).toBeCloseTo(beatToTime(note.beat, 150));
    }
  });

  it('最後のノーツのあとに終了余白がある', () => {
    const chart = createChart(120, [0, 7]);
    expect(chart.lengthSec).toBeGreaterThan(beatToTime(7, 120));
    expect(chart.totalBeats).toBe(7 + BEATS_PER_MEASURE);
  });

  it('ノーツ0件でも譜面を生成できる', () => {
    const chart = createChart(120, []);
    expect(chart.notes).toEqual([]);
    expect(chart.lengthSec).toBeGreaterThan(0);
  });
});

describe('createFableChart', () => {
  it('パターン定義どおりのノーツ数になる', () => {
    const expected = FABLE_PATTERNS.reduce((sum, m) => sum + m.length, 0);
    expect(createFableChart().notes).toHaveLength(expected);
  });

  it('最初のノーツはカウントイン後に始まる', () => {
    const chart = createFableChart();
    expect(chart.notes[0].beat).toBeGreaterThanOrEqual(COUNT_IN_BEATS);
  });

  it('デフォルトBPMが適用される', () => {
    expect(createFableChart().bpm).toBe(FABLE_BPM);
  });

  it('全ノーツの時刻が単調増加する', () => {
    const { notes } = createFableChart();
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i].time).toBeGreaterThan(notes[i - 1].time);
    }
  });
});
