import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BEATS_PER_MEASURE,
  COUNT_IN_BEATS,
  beatToTime,
  createFableChart,
  type Chart,
} from '../game/chart';
import { MISS_WINDOW, findTargetNoteIndex, judgeOffset } from '../game/judge';
import {
  applyJudgment,
  calcAccuracy,
  calcRank,
  createScoreState,
  type Rank,
  type ScoreState,
} from '../game/score';
import { GameAudio } from '../game/audio';
import type { Judgment } from '../game/types';

export type Phase = 'title' | 'playing' | 'result';

/** ノーツがヒットゾーンに到達するまでの表示時間(拍) */
const APPROACH_BEATS = 2;
/** 演奏開始までのリードタイム(秒) */
const LEAD_IN_SEC = 1.2;
/** メトロノームの先読み時間(秒) */
const TICK_LOOKAHEAD_SEC = 0.15;

export interface NoteView {
  id: number;
  /** 1=出現位置, 0=ヒットゾーン, 負=通り過ぎ */
  progress: number;
  missed: boolean;
}

export interface JudgmentEvent {
  type: Judgment;
  /** アニメーション再生成用の連番 */
  seq: number;
}

export interface GameSnapshot {
  phase: Phase;
  timeSec: number;
  /** 現在の拍(小数) */
  beat: number;
  /** カウントイン中の表示テキスト(それ以外は null) */
  countIn: string | null;
  notes: NoteView[];
  score: ScoreState;
  lastJudgment: JudgmentEvent | null;
  rank: Rank | null;
}

const COUNT_IN_TEXTS = ['いち', 'に', 'さん', 'ハイ!'];

function initialSnapshot(): GameSnapshot {
  return {
    phase: 'title',
    timeSec: 0,
    beat: 0,
    countIn: null,
    notes: [],
    score: createScoreState(),
    lastJudgment: null,
    rank: null,
  };
}

export interface GameEngine {
  snapshot: GameSnapshot;
  start: () => void;
  hit: () => void;
  backToTitle: () => void;
}

export function useGameEngine(): GameEngine {
  const [snapshot, setSnapshot] = useState<GameSnapshot>(initialSnapshot);

  const audioRef = useRef<GameAudio | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const startAtRef = useRef(0);
  const judgedRef = useRef<(Judgment | null)[]>([]);
  const scoreRef = useRef<ScoreState>(createScoreState());
  const nextTickBeatRef = useRef(0);
  const judgmentSeqRef = useRef(0);
  const lastJudgmentRef = useRef<JudgmentEvent | null>(null);
  const rafRef = useRef(0);
  const phaseRef = useRef<Phase>('title');

  const pushJudgment = useCallback((type: Judgment) => {
    judgmentSeqRef.current += 1;
    lastJudgmentRef.current = { type, seq: judgmentSeqRef.current };
  }, []);

  const buildNoteViews = useCallback((chart: Chart, timeSec: number): NoteView[] => {
    const approachSec = beatToTime(APPROACH_BEATS, chart.bpm);
    const views: NoteView[] = [];
    for (const note of chart.notes) {
      const judgment = judgedRef.current[note.id];
      // ヒット済みノーツは消す。ミスは流れ去るまで表示する
      if (judgment !== null && judgment !== 'miss') continue;
      const progress = (note.time - timeSec) / approachSec;
      if (progress > 1.05 || progress < -0.4) continue;
      views.push({ id: note.id, progress, missed: judgment === 'miss' });
    }
    return views;
  }, []);

  const finish = useCallback(() => {
    phaseRef.current = 'result';
    const rank = calcRank(calcAccuracy(scoreRef.current.counts));
    audioRef.current?.playResultJingle(rank);
    setSnapshot((prev) => ({
      ...prev,
      phase: 'result',
      notes: [],
      countIn: null,
      score: scoreRef.current,
      rank,
    }));
  }, []);

  const frame = useCallback(() => {
    const audio = audioRef.current;
    const chart = chartRef.current;
    if (!audio || !chart || phaseRef.current !== 'playing') return;

    const timeSec = audio.currentTime - startAtRef.current;
    const beat = (timeSec * chart.bpm) / 60;

    // 通り過ぎたノーツをミス確定にする
    for (const note of chart.notes) {
      if (judgedRef.current[note.id] === null && timeSec > note.time + MISS_WINDOW) {
        judgedRef.current[note.id] = 'miss';
        scoreRef.current = applyJudgment(scoreRef.current, 'miss');
        pushJudgment('miss');
        audio.playHit('miss');
      }
    }

    // メトロノームを先読みでスケジュールする
    while (
      nextTickBeatRef.current < chart.totalBeats &&
      beatToTime(nextTickBeatRef.current, chart.bpm) < timeSec + TICK_LOOKAHEAD_SEC
    ) {
      const tickBeat = nextTickBeatRef.current;
      audio.playTick(
        startAtRef.current + beatToTime(tickBeat, chart.bpm),
        tickBeat % BEATS_PER_MEASURE === 0,
      );
      nextTickBeatRef.current += 1;
    }

    if (timeSec > chart.lengthSec) {
      finish();
      return;
    }

    const countInIndex = Math.floor(beat);
    setSnapshot({
      phase: 'playing',
      timeSec,
      beat,
      countIn:
        beat >= 0 && countInIndex < COUNT_IN_BEATS ? COUNT_IN_TEXTS[countInIndex] : null,
      notes: buildNoteViews(chart, timeSec),
      score: scoreRef.current,
      lastJudgment: lastJudgmentRef.current,
      rank: null,
    });
    rafRef.current = requestAnimationFrame(frame);
  }, [buildNoteViews, finish, pushJudgment]);

  const start = useCallback(() => {
    const audio = (audioRef.current ??= new GameAudio());
    audio.ensure();
    const chart = createFableChart();
    chartRef.current = chart;
    judgedRef.current = chart.notes.map(() => null);
    scoreRef.current = createScoreState();
    nextTickBeatRef.current = 0;
    lastJudgmentRef.current = null;
    startAtRef.current = audio.currentTime + LEAD_IN_SEC;
    phaseRef.current = 'playing';
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(frame);
  }, [frame]);

  const hit = useCallback(() => {
    const audio = audioRef.current;
    const chart = chartRef.current;
    if (!audio || !chart || phaseRef.current !== 'playing') return;
    const timeSec = audio.currentTime - startAtRef.current;
    if (timeSec < 0) return;

    const index = findTargetNoteIndex(
      chart.notes.map((n) => n.time),
      judgedRef.current,
      timeSec,
    );
    if (index === -1) return;

    const note = chart.notes[index];
    const judgment = judgeOffset(timeSec - note.time);
    if (judgment === null) return;

    judgedRef.current[note.id] = judgment;
    scoreRef.current = applyJudgment(scoreRef.current, judgment);
    pushJudgment(judgment);
    audio.playHit(judgment);
  }, [pushJudgment]);

  const backToTitle = useCallback(() => {
    phaseRef.current = 'title';
    cancelAnimationFrame(rafRef.current);
    setSnapshot(initialSnapshot());
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return { snapshot, start, hit, backToTitle };
}
