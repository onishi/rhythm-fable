import { BEATS_PER_MEASURE, COUNT_IN_BEATS } from '../src/game/chart';
import { STAGES, STAGE_IDS, createStageChart } from '../src/game/stages';

describe('ステージ定義', () => {
  it('5ステージある', () => {
    expect(STAGES).toHaveLength(5);
  });

  it('IDが一意', () => {
    expect(new Set(STAGE_IDS).size).toBe(STAGES.length);
  });

  it.each(STAGES.map((s) => [s.title, s] as const))('%s: BPMが正の数', (_, stage) => {
    expect(stage.bpm).toBeGreaterThan(0);
  });

  it.each(STAGES.map((s) => [s.title, s] as const))('%s: 観客がいる', (_, stage) => {
    expect(stage.audience.length).toBeGreaterThan(0);
  });

  it.each(STAGES.map((s) => [s.title, s] as const))(
    '%s: 全ノーツ拍位置が小節内(0以上4未満)',
    (_, stage) => {
      for (const pattern of stage.patterns) {
        for (const offset of pattern) {
          expect(offset).toBeGreaterThanOrEqual(0);
          expect(offset).toBeLessThan(BEATS_PER_MEASURE);
        }
      }
    },
  );

  it.each(STAGES.map((s) => [s.title, s] as const))(
    '%s: スターノーツは通常パターンの部分集合',
    (_, stage) => {
      stage.stars.forEach((starOffsets, measure) => {
        for (const offset of starOffsets) {
          expect(stage.patterns[measure]).toContain(offset);
        }
      });
    },
  );

  it.each(STAGES.map((s) => [s.title, s] as const))(
    '%s: stars / bombs 配列は patterns と同じ小節数',
    (_, stage) => {
      expect(stage.stars).toHaveLength(stage.patterns.length);
      expect(stage.bombs).toHaveLength(stage.patterns.length);
    },
  );

  it.each(STAGES.map((s) => [s.title, s] as const))(
    '%s: おじゃまノーツは小節内(0以上4未満)',
    (_, stage) => {
      for (const bombs of stage.bombs) {
        for (const offset of bombs) {
          expect(offset).toBeGreaterThanOrEqual(0);
          expect(offset).toBeLessThan(BEATS_PER_MEASURE);
        }
      }
    },
  );

  it('echoステージはコール小節(偶数)が空でレスポンス小節(奇数)にノーツがある', () => {
    const echoStages = STAGES.filter((s) => s.gameSystem === 'echo');
    expect(echoStages.length).toBeGreaterThan(0);
    for (const stage of echoStages) {
      stage.patterns.forEach((pattern, measure) => {
        if (measure % 2 === 0) {
          expect(pattern).toHaveLength(0);
        } else {
          expect(pattern.length).toBeGreaterThan(0);
        }
      });
    }
  });

  it('echoステージにはおじゃまノーツがない(混乱防止)', () => {
    for (const stage of STAGES.filter((s) => s.gameSystem === 'echo')) {
      expect(stage.bombs.every((m) => m.length === 0)).toBe(true);
    }
  });

  it.each(STAGES.map((s) => [s.title, s] as const))(
    '%s: おじゃまノーツは通常ノーツから0.5拍以上離れている(誤爆防止)',
    (_, stage) => {
      const chart = createStageChart(stage);
      const bombBeats = chart.notes.filter((n) => n.kind === 'bomb').map((n) => n.beat);
      const playableBeats = chart.notes
        .filter((n) => n.kind !== 'bomb')
        .map((n) => n.beat);
      for (const bomb of bombBeats) {
        for (const playable of playableBeats) {
          expect(Math.abs(bomb - playable)).toBeGreaterThanOrEqual(0.5);
        }
      }
    },
  );
});

describe('createStageChart', () => {
  it.each(STAGES.map((s) => [s.title, s] as const))(
    '%s: ノーツ数がパターン+ボム定義と一致する',
    (_, stage) => {
      const expected =
        stage.patterns.reduce((sum, m) => sum + m.length, 0) +
        stage.bombs.reduce((sum, m) => sum + m.length, 0);
      expect(createStageChart(stage).notes).toHaveLength(expected);
    },
  );

  it.each(STAGES.map((s) => [s.title, s] as const))(
    '%s: おじゃまノーツ数が定義と一致する',
    (_, stage) => {
      const expected = stage.bombs.reduce((sum, m) => sum + m.length, 0);
      const bombs = createStageChart(stage).notes.filter((n) => n.kind === 'bomb');
      expect(bombs).toHaveLength(expected);
    },
  );

  it.each(STAGES.map((s) => [s.title, s] as const))(
    '%s: スターノーツ数が定義と一致する',
    (_, stage) => {
      const expected = stage.stars.reduce((sum, m) => sum + m.length, 0);
      const stars = createStageChart(stage).notes.filter((n) => n.kind === 'star');
      expect(stars).toHaveLength(expected);
    },
  );

  it.each(STAGES.map((s) => [s.title, s] as const))(
    '%s: 最初のノーツはカウントイン後',
    (_, stage) => {
      expect(createStageChart(stage).notes[0].beat).toBeGreaterThanOrEqual(COUNT_IN_BEATS);
    },
  );

  it.each(STAGES.map((s) => [s.title, s] as const))(
    '%s: ノーツの時刻が単調増加する',
    (_, stage) => {
      const { notes } = createStageChart(stage);
      for (let i = 1; i < notes.length; i++) {
        expect(notes[i].time).toBeGreaterThan(notes[i - 1].time);
      }
    },
  );
});
