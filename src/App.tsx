import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameEngine } from './hooks/useGameEngine';
import { StageSelect } from './components/StageSelect';
import { GameScreen, type RivalView } from './components/GameScreen';
import { ResultScreen } from './components/ResultScreen';
import { EndlessResultScreen } from './components/EndlessResultScreen';
import { VersusResultScreen } from './components/VersusResultScreen';
import { OnlineScreen } from './components/OnlineScreen';
import { OnlineResultScreen } from './components/OnlineResultScreen';
import { STAGES, STAGE_IDS } from './game/stages';
import { isPerfectPlay } from './game/score';
import { PLAYER_KEY_CODES, canPlayVersus } from './game/versus';
import { useOnlineRoom } from './online/useOnlineRoom';
import {
  isEndlessUnlocked,
  isNewRecord,
  isStageUnlocked,
  loadEndlessRecord,
  loadRecords,
  saveEndlessRecord,
  saveRecords,
  updateEndlessRecord,
  updateRecord,
  type EndlessRecord,
  type Records,
} from './game/progress';

interface ResultMeta {
  newRecord: boolean;
  unlockedNext: boolean;
}

/** セレクト画面でエンドレスカードが占める添字 */
const ENDLESS_INDEX = STAGES.length;

export function App() {
  const { snapshot, start, startEndless, startVersus, hit, backToTitle } = useGameEngine();
  const { phase } = snapshot;
  const online = useOnlineRoom();
  const { sendScore, sendFinish } = online;

  const [records, setRecords] = useState<Records>(() => loadRecords(window.localStorage));
  const [endlessRecord, setEndlessRecord] = useState<EndlessRecord | null>(() =>
    loadEndlessRecord(window.localStorage),
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playerCount, setPlayerCount] = useState(1);
  const [titleView, setTitleView] = useState<'select' | 'online'>('select');
  /** いまエンジンで動いているゲームがオンライン対戦か */
  const [onlineGame, setOnlineGame] = useState(false);
  const [resultMeta, setResultMeta] = useState<ResultMeta>({
    newRecord: false,
    unlockedNext: false,
  });
  const resultProcessedRef = useRef(false);
  const startSeqRef = useRef(0);
  const finishSentRef = useRef(false);

  const unlocked = STAGES.map((_, i) => isStageUnlocked(records, STAGE_IDS, i));
  const endlessUnlocked = isEndlessUnlocked(records, STAGE_IDS);

  const startAt = useCallback(
    (index: number) => {
      resultProcessedRef.current = false;
      setOnlineGame(false);
      if (index === ENDLESS_INDEX) {
        if (!endlessUnlocked || playerCount > 1) return;
        setSelectedIndex(index);
        startEndless();
        return;
      }
      if (!isStageUnlocked(records, STAGE_IDS, index)) return;
      const stage = STAGES[index];
      if (playerCount > 1) {
        if (!canPlayVersus(stage)) return;
        setSelectedIndex(index);
        startVersus(stage, playerCount);
        return;
      }
      setSelectedIndex(index);
      start(stage);
    },
    [records, endlessUnlocked, playerCount, start, startEndless, startVersus],
  );

  // オンライン: サーバーの開始合図でゲームを始める(ホスト・メンバー共通)
  useEffect(() => {
    const signal = online.state.startSignal;
    if (!signal || signal.seq === startSeqRef.current) return;
    startSeqRef.current = signal.seq;
    const stage = STAGES.find((s) => s.id === signal.stageId);
    if (!stage) return;
    resultProcessedRef.current = false;
    finishSentRef.current = false;
    setOnlineGame(true);
    start(stage);
  }, [online.state.startSignal, start]);

  // オンライン: プレイ中はスコアを実況送信する
  useEffect(() => {
    if (!onlineGame || phase !== 'playing') return;
    sendScore(snapshot.score.score, snapshot.score.combo);
  }, [onlineGame, phase, snapshot.score.score, snapshot.score.combo, sendScore]);

  // オンライン: たたき終わったら結果を送る
  useEffect(() => {
    if (!onlineGame || phase !== 'result' || finishSentRef.current) return;
    finishSentRef.current = true;
    sendFinish(snapshot.score.score, snapshot.score.maxCombo);
  }, [onlineGame, phase, snapshot.score.score, snapshot.score.maxCombo, sendFinish]);

  // リザルト確定時に記録を更新して保存する(オンラインは対象外)
  useEffect(() => {
    if (phase !== 'result' || resultProcessedRef.current || onlineGame) return;
    resultProcessedRef.current = true;

    // ローカル対戦はパーティーモードなので記録を残さない
    if (snapshot.mode === 'versus') {
      setResultMeta({ newRecord: false, unlockedNext: false });
      return;
    }

    if (snapshot.mode === 'endless') {
      const newRecord = snapshot.score.score > (endlessRecord?.bestScore ?? 0);
      const next = updateEndlessRecord(
        endlessRecord,
        snapshot.score.score,
        snapshot.round + 1,
      );
      setEndlessRecord(next);
      saveEndlessRecord(window.localStorage, next);
      setResultMeta({ newRecord, unlockedNext: false });
      return;
    }

    if (snapshot.rank === null) return;
    const stage = STAGES[selectedIndex];
    const newRecord = isNewRecord(records, stage.id, snapshot.score.score);
    const unlockedBefore = isStageUnlocked(records, STAGE_IDS, selectedIndex + 1);
    const next = updateRecord(
      records,
      stage.id,
      snapshot.score.score,
      snapshot.rank,
      isPerfectPlay(snapshot.score.counts),
    );
    const unlockedAfter = isStageUnlocked(next, STAGE_IDS, selectedIndex + 1);
    setRecords(next);
    saveRecords(window.localStorage, next);
    setResultMeta({
      newRecord,
      unlockedNext: selectedIndex + 1 < STAGES.length && unlockedAfter && !unlockedBefore,
    });
  }, [phase, snapshot, records, endlessRecord, selectedIndex, onlineGame]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase === 'playing') {
        if (snapshot.mode === 'versus') {
          const player = (PLAYER_KEY_CODES as readonly string[]).indexOf(e.code);
          if (player !== -1 && player < playerCount && !e.repeat) {
            e.preventDefault();
            hit(player);
          }
          return;
        }
        if (e.code === 'Space' && !e.repeat) {
          e.preventDefault();
          hit(0);
        }
        return;
      }
      if (phase === 'title' && titleView === 'select') {
        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          setSelectedIndex((i) => Math.max(0, i - 1));
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          setSelectedIndex((i) => Math.min(ENDLESS_INDEX, i + 1));
        } else if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          startAt(selectedIndex);
        }
        return;
      }
      // result(オンラインのリザルトはボタン操作のみ)
      if (phase === 'result' && !onlineGame && e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        startAt(selectedIndex);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, titleView, snapshot.mode, playerCount, onlineGame, hit, startAt, selectedIndex]);

  const rivals: RivalView[] | undefined =
    onlineGame && online.state.room
      ? online.state.room.players
          .filter((p) => p.id !== online.state.selfId)
          .map((p) => ({ id: p.id, name: p.name, slot: p.slot, score: p.score, combo: p.combo }))
      : undefined;

  if (phase === 'playing' && snapshot.stage !== null) {
    return (
      <GameScreen snapshot={snapshot} stage={snapshot.stage} onHit={hit} rivals={rivals} />
    );
  }
  if (phase === 'result' && onlineGame) {
    return (
      <OnlineResultScreen
        score={snapshot.score}
        online={online.state}
        onLobby={() => {
          online.returnToLobby();
          setOnlineGame(false);
          setTitleView('online');
          backToTitle();
        }}
        onLeave={() => {
          online.leave();
          setOnlineGame(false);
          setTitleView('select');
          backToTitle();
        }}
      />
    );
  }
  if (phase === 'result' && snapshot.mode === 'versus') {
    return (
      <VersusResultScreen
        players={snapshot.players}
        onRetry={() => startAt(selectedIndex)}
        onBackToSelect={backToTitle}
      />
    );
  }
  if (phase === 'result' && snapshot.mode === 'endless') {
    return (
      <EndlessResultScreen
        score={snapshot.score}
        round={snapshot.round + 1}
        record={endlessRecord}
        newRecord={resultMeta.newRecord}
        onRetry={() => startAt(ENDLESS_INDEX)}
        onBackToSelect={backToTitle}
      />
    );
  }
  if (phase === 'result' && snapshot.rank !== null) {
    return (
      <ResultScreen
        stage={STAGES[selectedIndex]}
        score={snapshot.score}
        rank={snapshot.rank}
        newRecord={resultMeta.newRecord}
        unlockedNext={resultMeta.unlockedNext}
        onRetry={() => startAt(selectedIndex)}
        onBackToSelect={backToTitle}
      />
    );
  }
  if (titleView === 'online') {
    return (
      <OnlineScreen online={online} stages={STAGES} onBack={() => setTitleView('select')} />
    );
  }
  return (
    <StageSelect
      stages={STAGES}
      records={records}
      unlocked={unlocked}
      endlessUnlocked={endlessUnlocked}
      endlessRecord={endlessRecord}
      selectedIndex={selectedIndex}
      playerCount={playerCount}
      onSelect={setSelectedIndex}
      onStart={startAt}
      onPlayerCount={setPlayerCount}
      onOnline={() => setTitleView('online')}
    />
  );
}
