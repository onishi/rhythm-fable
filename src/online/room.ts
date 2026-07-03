import { rankPlayers } from '../game/versus';
import type {
  ErrorReason,
  RoomPhase,
  RoomPlayerView,
  RoomView,
  Standing,
} from './protocol';

/** 1部屋の最大人数(ローカル対戦と同じ) */
export const ROOM_MAX_PLAYERS = 4;

/** サーバー内部のプレイヤー状態 */
export interface RoomPlayer extends RoomPlayerView {
  maxCombo: number;
}

/** サーバー内部の部屋状態(純粋関数で更新する) */
export interface RoomState {
  phase: RoomPhase;
  hostId: string | null;
  stageId: string | null;
  players: RoomPlayer[];
}

export function createRoomState(): RoomState {
  return { phase: 'lobby', hostId: null, stageId: null, players: [] };
}

/** 空いている席番号(入室順で最小の空き) */
function nextSlot(players: readonly RoomPlayer[]): number {
  const used = new Set(players.map((p) => p.slot));
  for (let slot = 0; slot < ROOM_MAX_PLAYERS; slot++) {
    if (!used.has(slot)) return slot;
  }
  return players.length;
}

export type JoinResult =
  | { ok: true; state: RoomState; player: RoomPlayer }
  | { ok: false; reason: ErrorReason };

export function addPlayer(state: RoomState, id: string, name: string): JoinResult {
  if (state.phase !== 'lobby') return { ok: false, reason: 'in-game' };
  if (state.players.length >= ROOM_MAX_PLAYERS) return { ok: false, reason: 'room-full' };
  const player: RoomPlayer = {
    id,
    name,
    slot: nextSlot(state.players),
    ready: false,
    finished: false,
    score: 0,
    combo: 0,
    maxCombo: 0,
  };
  return {
    ok: true,
    state: {
      ...state,
      hostId: state.hostId ?? id,
      players: [...state.players, player],
    },
    player,
  };
}

/** 退室。ホストが抜けたら次の入室者へ引き継ぐ */
export function removePlayer(state: RoomState, id: string): RoomState {
  const players = state.players.filter((p) => p.id !== id);
  return {
    ...state,
    players,
    hostId: state.hostId === id ? (players[0]?.id ?? null) : state.hostId,
  };
}

function updatePlayer(
  state: RoomState,
  id: string,
  patch: Partial<RoomPlayer>,
): RoomState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
}

export function setReady(state: RoomState, id: string, ready: boolean): RoomState {
  if (state.phase !== 'lobby') return state;
  return updatePlayer(state, id, { ready });
}

/** ホストが開始できるか(2人以上そろって、ホスト以外が全員じゅんびOK) */
export function canStart(state: RoomState, requesterId: string): boolean {
  return (
    state.phase === 'lobby' &&
    state.hostId === requesterId &&
    state.players.length >= 2 &&
    state.players.every((p) => p.id === state.hostId || p.ready)
  );
}

export function startGame(state: RoomState, stageId: string): RoomState {
  return {
    ...state,
    phase: 'playing',
    stageId,
    players: state.players.map((p) => ({
      ...p,
      ready: false,
      finished: false,
      score: 0,
      combo: 0,
      maxCombo: 0,
    })),
  };
}

export function recordScore(
  state: RoomState,
  id: string,
  score: number,
  combo: number,
): RoomState {
  if (state.phase !== 'playing') return state;
  return updatePlayer(state, id, { score, combo });
}

export function recordFinish(
  state: RoomState,
  id: string,
  score: number,
  maxCombo: number,
): RoomState {
  if (state.phase !== 'playing') return state;
  return updatePlayer(state, id, { score, maxCombo, finished: true });
}

/** 全員たたき終わったか(切断で0人になった場合は false) */
export function allFinished(state: RoomState): boolean {
  return state.players.length > 0 && state.players.every((p) => p.finished);
}

/** リザルト(スコア順にソート済み。順位は同点同順位) */
export function buildStandings(state: RoomState): Standing[] {
  const ranks = rankPlayers(state.players.map((p) => p.score));
  return state.players
    .map((p, i) => ({
      id: p.id,
      name: p.name,
      slot: p.slot,
      score: p.score,
      maxCombo: p.maxCombo,
      rank: ranks[i],
    }))
    .sort((a, b) => a.rank - b.rank || a.slot - b.slot);
}

/** リザルト後にロビーへ戻す */
export function backToLobby(state: RoomState): RoomState {
  return {
    ...state,
    phase: 'lobby',
    stageId: null,
    players: state.players.map((p) => ({ ...p, ready: false, finished: false })),
  };
}

/** クライアントに配る公開ビュー */
export function toRoomView(state: RoomState, code: string): RoomView {
  return {
    code,
    hostId: state.hostId ?? '',
    phase: state.phase,
    stageId: state.stageId,
    players: state.players.map(({ id, name, slot, ready, finished, score, combo }) => ({
      id,
      name,
      slot,
      ready,
      finished,
      score,
      combo,
    })),
  };
}
