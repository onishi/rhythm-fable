/**
 * オンライン対戦のクライアント/サーバー共有プロトコル。
 * Cloudflare Worker(Durable Object)と React クライアントの両方から import する。
 */

export type RoomPhase = 'lobby' | 'playing' | 'results';

/** 部屋にいる1プレイヤー(サーバーが配る公開情報) */
export interface RoomPlayerView {
  id: string;
  name: string;
  /** 入室順の席番号(0始まり。キャラ・色の割り当てに使う) */
  slot: number;
  ready: boolean;
  finished: boolean;
  score: number;
  combo: number;
}

/** 部屋全体の公開状態 */
export interface RoomView {
  code: string;
  hostId: string;
  phase: RoomPhase;
  stageId: string | null;
  players: RoomPlayerView[];
}

/** リザルトの1行 */
export interface Standing {
  id: string;
  name: string;
  slot: number;
  score: number;
  maxCombo: number;
  /** 0始まりの順位(同点は同順位) */
  rank: number;
}

/** クライアント → サーバー */
export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'ready'; ready: boolean }
  | { type: 'start'; stageId: string }
  | { type: 'score'; score: number; combo: number }
  | { type: 'finish'; score: number; maxCombo: number };

/** サーバー → クライアント */
export type ServerMessage =
  | { type: 'welcome'; selfId: string; room: RoomView }
  | { type: 'room'; room: RoomView }
  | { type: 'start'; stageId: string }
  | { type: 'rival'; id: string; score: number; combo: number }
  | { type: 'results'; standings: Standing[] }
  | { type: 'error'; reason: ErrorReason };

export type ErrorReason = 'room-not-found' | 'room-full' | 'in-game' | 'bad-request';

export const ERROR_TEXT: Record<ErrorReason, string> = {
  'room-not-found': 'そのあいことばの へやは みつからないよ',
  'room-full': 'へやが いっぱいだよ (さいだい4にん)',
  'in-game': 'いま プレイちゅうの へやだよ。まっててね',
  'bad-request': 'つうしんに しっぱいしたよ',
};

/** 部屋コード(あいことば)の長さと使える文字。まぎらわしい文字は除く */
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function isValidRoomCode(code: string): boolean {
  return (
    code.length === ROOM_CODE_LENGTH &&
    [...code].every((c) => ROOM_CODE_ALPHABET.includes(c))
  );
}

export function randomRoomCode(rng: () => number = Math.random): string {
  return Array.from(
    { length: ROOM_CODE_LENGTH },
    () => ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)],
  ).join('');
}

/** 名前は短く安全に(空なら「ゲスト」) */
export const MAX_NAME_LENGTH = 8;

export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return 'ゲスト';
  const name = raw.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MAX_NAME_LENGTH);
  return name === '' ? 'ゲスト' : name;
}

/** 受信 JSON を ClientMessage として検証する(不正なら null) */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'string' || raw.length > 512) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const msg = data as Record<string, unknown>;
  switch (msg.type) {
    case 'join':
      return { type: 'join', name: sanitizeName(msg.name) };
    case 'ready':
      return typeof msg.ready === 'boolean' ? { type: 'ready', ready: msg.ready } : null;
    case 'start':
      return typeof msg.stageId === 'string'
        ? { type: 'start', stageId: msg.stageId }
        : null;
    case 'score':
      return Number.isFinite(msg.score) && Number.isFinite(msg.combo)
        ? { type: 'score', score: Number(msg.score), combo: Number(msg.combo) }
        : null;
    case 'finish':
      return Number.isFinite(msg.score) && Number.isFinite(msg.maxCombo)
        ? { type: 'finish', score: Number(msg.score), maxCombo: Number(msg.maxCombo) }
        : null;
    default:
      return null;
  }
}
