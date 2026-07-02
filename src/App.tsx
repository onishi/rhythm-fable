import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameEngine } from './hooks/useGameEngine';
import { StageSelect } from './components/StageSelect';
import { GameScreen } from './components/GameScreen';
import { ResultScreen } from './components/ResultScreen';
import { STAGES, STAGE_IDS } from './game/stages';
import { isPerfectPlay } from './game/score';
import {
  isNewRecord,
  isStageUnlocked,
  loadRecords,
  saveRecords,
  updateRecord,
  type Records,
} from './game/progress';

interface ResultMeta {
  newRecord: boolean;
  unlockedNext: boolean;
}

export function App() {
  const { snapshot, start, hit, backToTitle } = useGameEngine();
  const { phase } = snapshot;

  const [records, setRecords] = useState<Records>(() => loadRecords(window.localStorage));
  const [stageIndex, setStageIndex] = useState(0);
  const [resultMeta, setResultMeta] = useState<ResultMeta>({
    newRecord: false,
    unlockedNext: false,
  });
  const resultProcessedRef = useRef(false);

  const stage = STAGES[stageIndex];
  const unlocked = STAGES.map((_, i) => isStageUnlocked(records, STAGE_IDS, i));

  const startStage = useCallback(
    (index: number) => {
      if (!isStageUnlocked(records, STAGE_IDS, index)) return;
      setStageIndex(index);
      resultProcessedRef.current = false;
      start(STAGES[index]);
    },
    [records, start],
  );

  // リザルト確定時に記録を更新して保存する
  useEffect(() => {
    if (phase !== 'result' || snapshot.rank === null || resultProcessedRef.current) return;
    resultProcessedRef.current = true;
    const newRecord = isNewRecord(records, stage.id, snapshot.score.score);
    const unlockedBefore = isStageUnlocked(records, STAGE_IDS, stageIndex + 1);
    const next = updateRecord(
      records,
      stage.id,
      snapshot.score.score,
      snapshot.rank,
      isPerfectPlay(snapshot.score.counts),
    );
    const unlockedAfter = isStageUnlocked(next, STAGE_IDS, stageIndex + 1);
    setRecords(next);
    saveRecords(window.localStorage, next);
    setResultMeta({
      newRecord,
      unlockedNext: stageIndex + 1 < STAGES.length && unlockedAfter && !unlockedBefore,
    });
  }, [phase, snapshot.rank, snapshot.score, records, stage.id, stageIndex]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase === 'playing') {
        if (e.code === 'Space' && !e.repeat) {
          e.preventDefault();
          hit();
        }
        return;
      }
      if (phase === 'title') {
        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          setStageIndex((i) => Math.max(0, i - 1));
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          setStageIndex((i) => Math.min(STAGES.length - 1, i + 1));
        } else if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          startStage(stageIndex);
        }
        return;
      }
      // result
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        startStage(stageIndex);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, hit, startStage, stageIndex]);

  if (phase === 'playing') {
    return <GameScreen snapshot={snapshot} stage={stage} onHit={hit} />;
  }
  if (phase === 'result' && snapshot.rank !== null) {
    return (
      <ResultScreen
        stage={stage}
        score={snapshot.score}
        rank={snapshot.rank}
        newRecord={resultMeta.newRecord}
        unlockedNext={resultMeta.unlockedNext}
        onRetry={() => startStage(stageIndex)}
        onBackToSelect={backToTitle}
      />
    );
  }
  return (
    <StageSelect
      stages={STAGES}
      records={records}
      unlocked={unlocked}
      selectedIndex={stageIndex}
      onSelect={setStageIndex}
      onStart={startStage}
    />
  );
}
