import type { Rank } from './score';

/** ステージごとのプレイ記録 */
export interface StageRecord {
  bestScore: number;
  bestRank: Rank;
  playCount: number;
}

export type Records = Record<string, StageRecord>;

const RANK_ORDER: Record<Rank, number> = { retry: 0, ok: 1, high: 2 };

/** ふたつの評価のよい方を返す */
export function betterRank(a: Rank, b: Rank): Rank {
  return RANK_ORDER[a] >= RANK_ORDER[b] ? a : b;
}

/** ハイスコアか判定する */
export function isNewRecord(records: Records, stageId: string, score: number): boolean {
  return score > (records[stageId]?.bestScore ?? 0);
}

/** プレイ結果を記録に反映した新しい Records を返す */
export function updateRecord(
  records: Records,
  stageId: string,
  score: number,
  rank: Rank,
): Records {
  const prev = records[stageId];
  return {
    ...records,
    [stageId]: {
      bestScore: Math.max(prev?.bestScore ?? 0, score),
      bestRank: prev ? betterRank(prev.bestRank, rank) : rank,
      playCount: (prev?.playCount ?? 0) + 1,
    },
  };
}

/** 「まずまず」以上の評価を取っていればクリア扱い */
export function isCleared(records: Records, stageId: string): boolean {
  const record = records[stageId];
  return record !== undefined && record.bestRank !== 'retry';
}

/** 最初のステージは常に解放。以降は前のステージをクリアで解放 */
export function isStageUnlocked(
  records: Records,
  stageIds: readonly string[],
  index: number,
): boolean {
  if (index === 0) return true;
  if (index < 0 || index >= stageIds.length) return false;
  return isCleared(records, stageIds[index - 1]);
}

const STORAGE_KEY = 'rhythm-fable-records-v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function isRank(value: unknown): value is Rank {
  return value === 'high' || value === 'ok' || value === 'retry';
}

/** localStorage などから記録を読み込む。壊れたデータは無視する */
export function loadRecords(storage: StorageLike): Records {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const records: Records = {};
    for (const [stageId, value] of Object.entries(parsed)) {
      if (typeof value !== 'object' || value === null) continue;
      const { bestScore, bestRank, playCount } = value as Record<string, unknown>;
      if (typeof bestScore !== 'number' || !isRank(bestRank)) continue;
      records[stageId] = {
        bestScore,
        bestRank,
        playCount: typeof playCount === 'number' ? playCount : 0,
      };
    }
    return records;
  } catch {
    return {};
  }
}

/** 記録を保存する(プライベートモードなどの失敗は握りつぶす) */
export function saveRecords(storage: StorageLike, records: Records): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // 保存できなくてもゲームは続行できる
  }
}
