import type { StageDef } from './stages';

/** マルチプレイの最大人数 */
export const MAX_PLAYERS = 4;

/** プレイヤーの表示名 */
export const PLAYER_LABELS = ['1P', '2P', '3P', '4P'] as const;

/** プレイヤーごとの担当キー(KeyboardEvent.code) */
export const PLAYER_KEY_CODES = ['KeyA', 'KeyF', 'KeyJ', 'Semicolon'] as const;

/** キーの表示用ラベル */
export const PLAYER_KEY_LABELS = ['A', 'F', 'J', ';'] as const;

/** プレイヤーの操作キャラクター */
export const PLAYER_CHARACTERS = ['🐱', '🐶', '🐼', '🐷'] as const;

/** プレイヤーのテーマカラー */
export const PLAYER_COLORS = ['#ff5d7d', '#3d8bff', '#28b463', '#f39c12'] as const;

/** 順位表示用の絵文字(0位=優勝から) */
export const PLACE_EMOJI = ['🥇', '🥈', '🥉', '🎖️'] as const;

/**
 * 対戦で遊べるステージか。
 * コール&レスポンス型は1画面に複数プレイヤーを表示できないため1P専用。
 */
export function canPlayVersus(stage: StageDef): boolean {
  return (stage.gameSystem ?? 'flow') === 'flow';
}

/**
 * スコアから各プレイヤーの順位(0始まり)を返す。
 * 同点は同順位(standard competition ranking: 100,100,50 → 0,0,2)。
 */
export function rankPlayers(scores: readonly number[]): number[] {
  return scores.map((score) => scores.filter((other) => other > score).length);
}
