import { COUNT_IN_BEATS, buildBeats, createChart, type Chart } from './chart';
import { STAGES, type StageDef } from './stages';

/** エンドレス開始時のBPM */
export const ENDLESS_START_BPM = 104;
/** ラウンドごとのBPM上昇量 */
export const ENDLESS_BPM_STEP = 8;
/** BPMの上限 */
export const ENDLESS_MAX_BPM = 176;
/** 1ラウンドの小節数 */
export const ENDLESS_MEASURES_PER_ROUND = 8;
/** ライフ数(ミスで減り、0でゲームオーバー) */
export const ENDLESS_LIVES = 3;
/** ラウンド2以降の頭に入る空白拍(ノーツ表示の助走) */
export const ROUND_LEAD_BEATS = 2;

/**
 * シード付き乱数生成器(mulberry32)。
 * 同じシードなら同じ列を返すのでテスト・リプレイ可能。
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ラウンドのBPM(上限あり) */
export function roundBpm(round: number): number {
  return Math.min(ENDLESS_START_BPM + round * ENDLESS_BPM_STEP, ENDLESS_MAX_BPM);
}

export interface EndlessRoundSpec {
  /** ビジュアル・音楽の元になるステージ */
  stage: StageDef;
  bpm: number;
  patterns: readonly (readonly number[])[];
  stars: readonly (readonly number[])[];
  bombs: readonly (readonly number[])[];
}

/**
 * ラウンドの譜面素材を作る。
 * ランダムに選んだステージから連続した小節を切り出す(音楽的な流れを保つ)。
 */
export function buildEndlessRoundSpec(
  round: number,
  rng: () => number,
  stages: readonly StageDef[] = STAGES,
): EndlessRoundSpec {
  // コール&レスポンス型はノーツが流れないため素材から除外する
  const pool = stages.filter((s) => (s.gameSystem ?? 'flow') === 'flow');
  const stage = pool[Math.floor(rng() * pool.length)];
  const span = Math.min(ENDLESS_MEASURES_PER_ROUND, stage.patterns.length);
  const maxStart = stage.patterns.length - span;
  const start = Math.floor(rng() * (maxStart + 1));
  return {
    stage,
    bpm: roundBpm(round),
    patterns: stage.patterns.slice(start, start + span),
    stars: stage.stars.slice(start, start + span),
    bombs: stage.bombs.slice(start, start + span),
  };
}

/**
 * ラウンド譜面を生成する。
 * 最初のラウンドはカウントイン4拍、以降は2拍の助走だけで続ける。
 */
export function createEndlessRoundChart(spec: EndlessRoundSpec, round: number): Chart {
  const startBeat = round === 0 ? COUNT_IN_BEATS : ROUND_LEAD_BEATS;
  return createChart(
    spec.bpm,
    buildBeats(spec.patterns, startBeat),
    buildBeats(spec.stars, startBeat),
    buildBeats(spec.bombs, startBeat),
  );
}
