import { COUNT_IN_BEATS, createChart } from '../src/game/chart';
import { buildMusicEvents, midiToFreq, type StageMusic } from '../src/game/music';

const MUSIC: StageMusic = {
  bassRoots: [48, 53],
  scale: [60, 62, 64, 67, 69],
};

describe('midiToFreq', () => {
  it('A4(69)は440Hz', () => {
    expect(midiToFreq(69)).toBe(440);
  });

  it('1オクターブ上(81)は880Hz', () => {
    expect(midiToFreq(81)).toBeCloseTo(880);
  });

  it('C4(60)は約261.6Hz', () => {
    expect(midiToFreq(60)).toBeCloseTo(261.63, 1);
  });
});

describe('buildMusicEvents', () => {
  const chart = createChart(120, [4, 5, 6, 8, 10]);
  const events = buildMusicEvents(chart, MUSIC);

  it('時間昇順に並ぶ', () => {
    for (let i = 1; i < events.length; i++) {
      expect(events[i].time).toBeGreaterThanOrEqual(events[i - 1].time);
    }
  });

  it('カウントイン中はクリック音のみ', () => {
    const countInEnd = (COUNT_IN_BEATS * 60) / 120;
    const early = events.filter((e) => e.time < countInEnd);
    expect(early.length).toBeGreaterThan(0);
    expect(early.every((e) => e.kind === 'count')).toBe(true);
  });

  it('カウントインのクリック数は COUNT_IN_BEATS と一致', () => {
    expect(events.filter((e) => e.kind === 'count')).toHaveLength(COUNT_IN_BEATS);
  });

  it('メロディ数はノーツ数と一致', () => {
    expect(events.filter((e) => e.kind === 'melody')).toHaveLength(chart.notes.length);
  });

  it('メロディの音高はスケール内から選ばれる', () => {
    for (const e of events.filter((e) => e.kind === 'melody')) {
      expect(MUSIC.scale).toContain(e.midi);
    }
  });

  it('ベースの音高は bassRoots からループで選ばれる', () => {
    for (const e of events.filter((e) => e.kind === 'bass')) {
      expect(MUSIC.bassRoots).toContain(e.midi);
    }
  });

  it('キックとスネアが交互に鳴る(小節内の偶数拍=キック)', () => {
    const kicks = events.filter((e) => e.kind === 'kick');
    const snares = events.filter((e) => e.kind === 'snare');
    expect(kicks.length).toBeGreaterThan(0);
    expect(snares.length).toBeGreaterThan(0);
    // BPM120: カウントイン後の最初の拍(2.0秒)はキック
    expect(kicks.some((e) => e.time === 2)).toBe(true);
    // その次の拍(2.5秒)はスネア
    expect(snares.some((e) => e.time === 2.5)).toBe(true);
  });

  it('ハイハットは8分裏に鳴る', () => {
    const hats = events.filter((e) => e.kind === 'hat');
    for (const hat of hats) {
      // 拍に直すと .5 のはず
      const beat = (hat.time * 120) / 60;
      expect(beat % 1).toBeCloseTo(0.5);
    }
  });

  it('メロディは決定的(同じ入力なら同じ結果)', () => {
    expect(buildMusicEvents(chart, MUSIC)).toEqual(events);
  });
});
