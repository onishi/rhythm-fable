/// <reference types="@cloudflare/workers-types" />
/**
 * リズムFable のオンライン対戦サーバー(Cloudflare Workers)。
 * 部屋(あいことば)ごとに1つの Durable Object が WebSocket を束ねる。
 * 静的アセットは wrangler の assets 設定が配信し、/api/* だけがここに届く。
 */
import {
  isValidRoomCode,
  parseClientMessage,
  randomRoomCode,
  type ServerMessage,
} from '../src/online/protocol';
import {
  addPlayer,
  allFinished,
  backToLobby,
  buildStandings,
  canStart,
  createRoomState,
  recordFinish,
  recordScore,
  removePlayer,
  setReady,
  startGame,
  toRoomView,
  type RoomState,
} from '../src/online/room';
import { STAGE_IDS } from '../src/game/stages';

export interface Env {
  ROOMS: DurableObjectNamespace;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 部屋を新規作成(空いているあいことばを探して返す)
    if (url.pathname === '/api/room' && request.method === 'POST') {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomRoomCode();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const res = await stub.fetch('https://room/reserve');
        const { available } = (await res.json()) as { available: boolean };
        if (available) return json({ code });
      }
      return json({ error: 'no-room' }, 503);
    }

    // WebSocket 接続: /api/room/:code/ws
    const match = url.pathname.match(/^\/api\/room\/([A-Z0-9]+)\/ws$/);
    if (match) {
      const code = match[1];
      if (!isValidRoomCode(code)) return json({ error: 'bad-code' }, 400);
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return json({ error: 'expected-websocket' }, 426);
      }
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      return stub.fetch(`https://room/ws?code=${code}`, request);
    }

    return json({ error: 'not-found' }, 404);
  },
};

interface Session {
  ws: WebSocket;
  playerId: string;
  joined: boolean;
}

/** ゲーム開始から強制終了までの猶予(タブ放置対策) */
const GAME_TIMEOUT_MS = 3 * 60 * 1000;

export class RoomDO {
  private sessions: Session[] = [];
  private room: RoomState = createRoomState();
  private code = '';
  /** 「へやを つくる」で確保済みか。未確保の部屋には join できない */
  private reserved = false;
  private gameTimeout: ReturnType<typeof setTimeout> | null = null;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/reserve') {
      // 使用中・確保済みの部屋コードは新規作成に使わない
      if (this.reserved || this.sessions.length > 0) return json({ available: false });
      this.reserved = true;
      return json({ available: true });
    }

    if (url.pathname === '/ws') {
      this.code = url.searchParams.get('code') ?? this.code;
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      this.accept(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return json({ error: 'not-found' }, 404);
  }

  private accept(ws: WebSocket): void {
    ws.accept();
    const session: Session = {
      ws,
      playerId: crypto.randomUUID().slice(0, 8),
      joined: false,
    };
    this.sessions.push(session);
    ws.addEventListener('message', (event) => this.onMessage(session, event.data));
    const drop = () => this.onClose(session);
    ws.addEventListener('close', drop);
    ws.addEventListener('error', drop);
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // 切断済みソケットへの送信は無視(close イベント側で片付ける)
    }
  }

  private broadcast(message: ServerMessage, except?: Session): void {
    for (const session of this.sessions) {
      if (session.joined && session !== except) this.send(session.ws, message);
    }
  }

  private broadcastRoom(): void {
    this.broadcast({ type: 'room', room: toRoomView(this.room, this.code) });
  }

  private onMessage(session: Session, data: unknown): void {
    const msg = parseClientMessage(data);
    if (msg === null) {
      this.send(session.ws, { type: 'error', reason: 'bad-request' });
      return;
    }

    if (msg.type === 'join') {
      if (session.joined) return;
      if (!this.reserved) {
        // 「つくる」を経ていない部屋コードには入れない
        this.send(session.ws, { type: 'error', reason: 'room-not-found' });
        session.ws.close(1000, 'room-not-found');
        return;
      }
      const result = addPlayer(this.room, session.playerId, msg.name);
      if (!result.ok) {
        this.send(session.ws, { type: 'error', reason: result.reason });
        session.ws.close(1000, result.reason);
        return;
      }
      this.room = result.state;
      session.joined = true;
      this.send(session.ws, {
        type: 'welcome',
        selfId: session.playerId,
        room: toRoomView(this.room, this.code),
      });
      this.broadcastRoom();
      return;
    }

    if (!session.joined) return;

    switch (msg.type) {
      case 'ready':
        this.room = setReady(this.room, session.playerId, msg.ready);
        this.broadcastRoom();
        return;
      case 'start':
        if (!canStart(this.room, session.playerId)) return;
        if (!STAGE_IDS.includes(msg.stageId)) return;
        this.room = startGame(this.room, msg.stageId);
        this.broadcast({ type: 'start', stageId: msg.stageId });
        this.broadcastRoom();
        this.armGameTimeout();
        return;
      case 'score':
        this.room = recordScore(this.room, session.playerId, msg.score, msg.combo);
        this.broadcast(
          { type: 'rival', id: session.playerId, score: msg.score, combo: msg.combo },
          session,
        );
        return;
      case 'finish':
        this.room = recordFinish(this.room, session.playerId, msg.score, msg.maxCombo);
        this.broadcastRoom();
        this.maybeFinishGame();
        return;
    }
  }

  private onClose(session: Session): void {
    const index = this.sessions.indexOf(session);
    if (index === -1) return;
    this.sessions.splice(index, 1);
    if (!session.joined) return;
    this.room = removePlayer(this.room, session.playerId);
    if (this.room.players.length === 0) {
      // 全員退室したら部屋を初期化してコードを再利用可能にする
      this.room = createRoomState();
      this.reserved = false;
      this.clearGameTimeout();
      return;
    }
    this.maybeFinishGame();
    this.broadcastRoom();
  }

  /** プレイ中で全員たたき終わっていたらリザルトを配ってロビーへ戻す */
  private maybeFinishGame(): void {
    if (this.room.phase !== 'playing' || !allFinished(this.room)) return;
    this.clearGameTimeout();
    this.broadcast({ type: 'results', standings: buildStandings(this.room) });
    this.room = backToLobby(this.room);
    this.broadcastRoom();
  }

  private armGameTimeout(): void {
    this.clearGameTimeout();
    this.gameTimeout = setTimeout(() => {
      // 応答がないプレイヤーがいても現時点のスコアで打ち切る
      if (this.room.phase !== 'playing') return;
      this.broadcast({ type: 'results', standings: buildStandings(this.room) });
      this.room = backToLobby(this.room);
      this.broadcastRoom();
    }, GAME_TIMEOUT_MS);
  }

  private clearGameTimeout(): void {
    if (this.gameTimeout !== null) {
      clearTimeout(this.gameTimeout);
      this.gameTimeout = null;
    }
  }
}
