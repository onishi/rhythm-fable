import {
  betterRank,
  isCleared,
  isEndlessUnlocked,
  isNewRecord,
  isStageUnlocked,
  loadEndlessRecord,
  loadRecords,
  saveEndlessRecord,
  saveRecords,
  updateEndlessRecord,
  updateRecord,
  type Records,
} from '../src/game/progress';

const STAGE_IDS = ['forest', 'moon', 'festival'];

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    dump: () => map,
  };
}

describe('betterRank', () => {
  it('high > ok > retry の順で強い', () => {
    expect(betterRank('high', 'ok')).toBe('high');
    expect(betterRank('retry', 'ok')).toBe('ok');
    expect(betterRank('retry', 'retry')).toBe('retry');
  });
});

describe('updateRecord', () => {
  it('初回プレイで記録が作られる', () => {
    const records = updateRecord({}, 'forest', 500, 'ok');
    expect(records.forest).toEqual({
      bestScore: 500,
      bestRank: 'ok',
      playCount: 1,
      perfectCount: 0,
    });
  });

  it('パーフェクト達成で perfectCount が増える', () => {
    let records = updateRecord({}, 'forest', 500, 'high', true);
    expect(records.forest.perfectCount).toBe(1);
    records = updateRecord(records, 'forest', 600, 'high', false);
    expect(records.forest.perfectCount).toBe(1);
    records = updateRecord(records, 'forest', 700, 'high', true);
    expect(records.forest.perfectCount).toBe(2);
  });

  it('ベストスコア・ベスト評価は良い方を保持する', () => {
    let records = updateRecord({}, 'forest', 500, 'high');
    records = updateRecord(records, 'forest', 300, 'retry');
    expect(records.forest.bestScore).toBe(500);
    expect(records.forest.bestRank).toBe('high');
    expect(records.forest.playCount).toBe(2);
  });

  it('更新すればスコアが上がる', () => {
    let records = updateRecord({}, 'forest', 300, 'ok');
    records = updateRecord(records, 'forest', 800, 'high');
    expect(records.forest.bestScore).toBe(800);
    expect(records.forest.bestRank).toBe('high');
  });

  it('元の Records を変更しない', () => {
    const original: Records = {};
    updateRecord(original, 'forest', 100, 'ok');
    expect(original.forest).toBeUndefined();
  });
});

describe('isNewRecord', () => {
  it('記録がなければどんなスコアでも新記録', () => {
    expect(isNewRecord({}, 'forest', 1)).toBe(true);
  });

  it('ベスト超えのみ新記録', () => {
    const records = updateRecord({}, 'forest', 500, 'ok');
    expect(isNewRecord(records, 'forest', 501)).toBe(true);
    expect(isNewRecord(records, 'forest', 500)).toBe(false);
  });
});

describe('isCleared / isStageUnlocked', () => {
  it('まずまず以上でクリア扱い', () => {
    expect(isCleared(updateRecord({}, 'forest', 100, 'ok'), 'forest')).toBe(true);
    expect(isCleared(updateRecord({}, 'forest', 100, 'high'), 'forest')).toBe(true);
    expect(isCleared(updateRecord({}, 'forest', 100, 'retry'), 'forest')).toBe(false);
    expect(isCleared({}, 'forest')).toBe(false);
  });

  it('最初のステージは常に解放', () => {
    expect(isStageUnlocked({}, STAGE_IDS, 0)).toBe(true);
  });

  it('前のステージをクリアすると解放される', () => {
    expect(isStageUnlocked({}, STAGE_IDS, 1)).toBe(false);
    const records = updateRecord({}, 'forest', 500, 'ok');
    expect(isStageUnlocked(records, STAGE_IDS, 1)).toBe(true);
    expect(isStageUnlocked(records, STAGE_IDS, 2)).toBe(false);
  });

  it('範囲外の添字は解放されない', () => {
    expect(isStageUnlocked({}, STAGE_IDS, -1)).toBe(false);
    expect(isStageUnlocked({}, STAGE_IDS, STAGE_IDS.length)).toBe(false);
  });
});

describe('loadRecords / saveRecords', () => {
  it('保存して読み込むと同じ内容になる', () => {
    const storage = fakeStorage();
    const records = updateRecord(updateRecord({}, 'forest', 500, 'high'), 'moon', 300, 'ok');
    saveRecords(storage, records);
    expect(loadRecords(storage)).toEqual(records);
  });

  it('データがなければ空', () => {
    expect(loadRecords(fakeStorage())).toEqual({});
  });

  it('壊れたJSONは空として扱う', () => {
    const storage = fakeStorage({ 'rhythm-fable-records-v1': '{oops' });
    expect(loadRecords(storage)).toEqual({});
  });

  it('形式が違うデータは無視する', () => {
    const storage = fakeStorage({
      'rhythm-fable-records-v1': JSON.stringify({
        forest: { bestScore: 100, bestRank: 'high', playCount: 2 },
        broken1: { bestScore: 'abc', bestRank: 'high' },
        broken2: { bestScore: 100, bestRank: 'god' },
        broken3: null,
      }),
    });
    const records = loadRecords(storage);
    expect(records.forest).toEqual({
      bestScore: 100,
      bestRank: 'high',
      playCount: 2,
      perfectCount: 0,
    });
    expect(records.broken1).toBeUndefined();
    expect(records.broken2).toBeUndefined();
    expect(records.broken3).toBeUndefined();
  });

  it('perfectCount がない旧データも読み込める(0扱い)', () => {
    const storage = fakeStorage({
      'rhythm-fable-records-v1': JSON.stringify({
        forest: { bestScore: 100, bestRank: 'ok', playCount: 1 },
      }),
    });
    expect(loadRecords(storage).forest.perfectCount).toBe(0);
  });

  it('配列が保存されていても空として扱う', () => {
    const storage = fakeStorage({ 'rhythm-fable-records-v1': '[1,2]' });
    expect(loadRecords(storage)).toEqual({});
  });

  it('setItem が例外を投げても saveRecords は落ちない', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    };
    expect(() => saveRecords(storage, {})).not.toThrow();
  });
});

describe('エンドレス', () => {
  it('全ステージクリアで解放される', () => {
    let records: Records = {};
    expect(isEndlessUnlocked(records, STAGE_IDS)).toBe(false);
    records = updateRecord(records, 'forest', 100, 'ok');
    records = updateRecord(records, 'moon', 100, 'high');
    expect(isEndlessUnlocked(records, STAGE_IDS)).toBe(false);
    records = updateRecord(records, 'festival', 100, 'ok');
    expect(isEndlessUnlocked(records, STAGE_IDS)).toBe(true);
  });

  it('やりなおし評価ではクリア扱いにならない', () => {
    let records: Records = {};
    for (const id of STAGE_IDS) {
      records = updateRecord(records, id, 100, 'retry');
    }
    expect(isEndlessUnlocked(records, STAGE_IDS)).toBe(false);
  });

  it('updateEndlessRecord はベストを保持する', () => {
    let record = updateEndlessRecord(null, 1000, 3);
    expect(record).toEqual({ bestScore: 1000, bestRound: 3, playCount: 1 });
    record = updateEndlessRecord(record, 500, 5);
    expect(record).toEqual({ bestScore: 1000, bestRound: 5, playCount: 2 });
    record = updateEndlessRecord(record, 2000, 2);
    expect(record).toEqual({ bestScore: 2000, bestRound: 5, playCount: 3 });
  });

  it('保存して読み込むと同じ内容になる', () => {
    const storage = fakeStorage();
    const record = updateEndlessRecord(null, 1500, 4);
    saveEndlessRecord(storage, record);
    expect(loadEndlessRecord(storage)).toEqual(record);
  });

  it('データがなければ null', () => {
    expect(loadEndlessRecord(fakeStorage())).toBeNull();
  });

  it('壊れたデータは null として扱う', () => {
    expect(loadEndlessRecord(fakeStorage({ 'rhythm-fable-endless-v1': '{oops' }))).toBeNull();
    expect(
      loadEndlessRecord(
        fakeStorage({ 'rhythm-fable-endless-v1': JSON.stringify({ bestScore: 'abc' }) }),
      ),
    ).toBeNull();
  });
});
