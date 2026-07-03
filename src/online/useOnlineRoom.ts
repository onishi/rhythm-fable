import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ERROR_TEXT,
  type ClientMessage,
  type RoomView,
  type ServerMessage,
  type Standing,
} from './protocol';

export type OnlineStatus = 'idle' | 'connecting' | 'lobby' | 'playing' | 'results';

export interface OnlineState {
  status: OnlineStatus;
  /** 接続失敗・切断の理由(表示用) */
  error: string | null;
  selfId: string;
  room: RoomView | null;
  /** サーバーからの開始合図(seq が変わったら新しい合図) */
  startSignal: { stageId: string; seq: number } | null;
  standings: Standing[] | null;
}

const IDLE: OnlineState = {
  status: 'idle',
  error: null,
  selfId: '',
  room: null,
  startSignal: null,
  standings: null,
};

/** スコア実況の送信間隔(ms) */
const SCORE_INTERVAL_MS = 250;

/** WebSocket の接続先(開発時は vite が wrangler dev に中継する) */
function wsUrl(code: string): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/api/room/${code}/ws`;
}

export interface OnlineRoom {
  state: OnlineState;
  createRoom: (name: string) => Promise<void>;
  joinRoom: (code: string, name: string) => void;
  setReady: (ready: boolean) => void;
  startGame: (stageId: string) => void;
  sendScore: (score: number, combo: number) => void;
  sendFinish: (score: number, maxCombo: number) => void;
  returnToLobby: () => void;
  leave: () => void;
}

export function useOnlineRoom(): OnlineRoom {
  const [state, setState] = useState<OnlineState>(IDLE);
  const wsRef = useRef<WebSocket | null>(null);
  const startSeqRef = useRef(0);
  const lastScoreSentRef = useRef(0);
  const pendingScoreRef = useRef<{ score: number; combo: number } | null>(null);
  const scoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeSocket = useCallback(() => {
    if (scoreTimerRef.current !== null) {
      clearTimeout(scoreTimerRef.current);
      scoreTimerRef.current = null;
    }
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.close();
    }
  }, []);

  const send = useCallback((message: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, []);

  const connect = useCallback(
    (code: string, name: string) => {
      closeSocket();
      setState({ ...IDLE, status: 'connecting' });
      const ws = new WebSocket(wsUrl(code.toUpperCase()));
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join', name } satisfies ClientMessage));
      };

      ws.onmessage = (event) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }
        setState((prev) => {
          switch (msg.type) {
            case 'welcome':
              return { ...prev, status: 'lobby', selfId: msg.selfId, room: msg.room };
            case 'room':
              return { ...prev, room: msg.room };
            case 'start':
              startSeqRef.current += 1;
              return {
                ...prev,
                status: 'playing',
                standings: null,
                startSignal: { stageId: msg.stageId, seq: startSeqRef.current },
              };
            case 'rival': {
              if (!prev.room) return prev;
              const players = prev.room.players.map((p) =>
                p.id === msg.id ? { ...p, score: msg.score, combo: msg.combo } : p,
              );
              return { ...prev, room: { ...prev.room, players } };
            }
            case 'results':
              return { ...prev, status: 'results', standings: msg.standings };
            case 'error':
              return { ...IDLE, error: ERROR_TEXT[msg.reason] ?? ERROR_TEXT['bad-request'] };
          }
        });
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        setState((prev) =>
          prev.status === 'idle'
            ? prev
            : { ...IDLE, error: prev.error ?? 'せつだんされたよ。もういちど はいってね' },
        );
      };

      ws.onerror = () => {
        // onclose 側でまとめて処理する
      };
    },
    [closeSocket],
  );

  const createRoom = useCallback(
    async (name: string) => {
      setState({ ...IDLE, status: 'connecting' });
      try {
        const res = await fetch('/api/room', { method: 'POST' });
        if (!res.ok) throw new Error('create failed');
        const { code } = (await res.json()) as { code: string };
        connect(code, name);
      } catch {
        setState({ ...IDLE, error: 'へやを つくれなかったよ。でんぱを かくにんしてね' });
      }
    },
    [connect],
  );

  const joinRoom = useCallback(
    (code: string, name: string) => connect(code, name),
    [connect],
  );

  const setReady = useCallback(
    (ready: boolean) => send({ type: 'ready', ready }),
    [send],
  );

  const startGame = useCallback(
    (stageId: string) => send({ type: 'start', stageId }),
    [send],
  );

  /** スコア実況(送りすぎないよう SCORE_INTERVAL_MS に間引く) */
  const sendScore = useCallback(
    (score: number, combo: number) => {
      pendingScoreRef.current = { score, combo };
      if (scoreTimerRef.current !== null) return;
      const elapsed = Date.now() - lastScoreSentRef.current;
      const wait = Math.max(0, SCORE_INTERVAL_MS - elapsed);
      scoreTimerRef.current = setTimeout(() => {
        scoreTimerRef.current = null;
        const pending = pendingScoreRef.current;
        if (pending === null) return;
        pendingScoreRef.current = null;
        lastScoreSentRef.current = Date.now();
        send({ type: 'score', score: pending.score, combo: pending.combo });
      }, wait);
    },
    [send],
  );

  const sendFinish = useCallback(
    (score: number, maxCombo: number) => {
      pendingScoreRef.current = null;
      send({ type: 'finish', score, maxCombo });
    },
    [send],
  );

  /** リザルトからロビー表示へ戻る(サーバー側の部屋はすでにロビーに戻っている) */
  const returnToLobby = useCallback(() => {
    setState((prev) =>
      prev.status === 'results' ? { ...prev, status: 'lobby', standings: null } : prev,
    );
  }, []);

  const leave = useCallback(() => {
    closeSocket();
    setState(IDLE);
  }, [closeSocket]);

  useEffect(() => closeSocket, [closeSocket]);

  return {
    state,
    createRoom,
    joinRoom,
    setReady,
    startGame,
    sendScore,
    sendFinish,
    returnToLobby,
    leave,
  };
}
