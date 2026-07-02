import { useCallback, useEffect, useRef, useState } from 'react';
import { COUNT_IN_BEATS, beatToTime, type Chart } from '../game/chart';
import {
  MISS_WINDOW,
  findTargetNoteIndex,
  judgeOffset,
  type NoteResult,
} from '../game/judge';
import {
  applyJudgment,
  calcAccuracy,
  calcRank,
  createScoreState,
  isFever,
  type Rank,
  type ScoreState,
} from '../game/score';
import { buildMusicEvents, type MusicEvent } from '../game/music';
import { createStageChart, type StageDef } from '../game/stages';
import { GameAudio } from '../game/audio';
import type { Judgment, NoteKind } from '../game/types';

export type Phase = 'title' | 'playing' | 'result';

/** ノーツがヒットゾーンに到達するまでの表示時間(拍) */
const APPROACH_BEATS = 2;
/** 演奏開始までのリードタイム(秒) */
const LEAD_IN_SEC = 1.2;
/** 伴奏の先読み時間(秒) */
const LOOKAHEAD_SEC = 0.15;

export interface NoteView {
  id: number;
  /** 1=出現位置, 0=ヒットゾーン, 負=通り過ぎ */
  progress: number;
  kind: NoteKind;
  missed: boolean;
}

/** 「はやい/おそい」のヒント(perfect と自動ミスでは null) */
export type TimingHint = 'early' | 'late' | null;

export interface JudgmentEvent {
  type: Judgment;
  hint: TimingHint;
  /** おじゃまノーツを叩いてしまった */
  bomb: boolean;
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
  start: (stage: StageDef) => void;
  hit: () => void;
  backToTitle: () => void;
}

export function useGameEngine(): GameEngine {
  const [snapshot, setSnapshot] = useState<GameSnapshot>(initialSnapshot);

  const audioRef = useRef<GameAudio | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const musicEventsRef = useRef<MusicEvent[]>([]);
  const musicIndexRef = useRef(0);
  const startAtRef = useRef(0);
  const judgedRef = useRef<(NoteResult | null)[]>([]);
  const scoreRef = useRef<ScoreState>(createScoreState());
  const judgmentSeqRef = useRef(0);
  const lastJudgmentRef = useRef<JudgmentEvent | null>(null);
  const rafRef = useRef(0);
  const phaseRef = useRef<Phase>('title');

  const pushJudgment = useCallback(
    (type: Judgment, hint: TimingHint = null, bomb = false) => {
      judgmentSeqRef.current += 1;
      lastJudgmentRef.current = { type, hint, bomb, seq: judgmentSeqRef.current };
    },
    [],
  );

  /** スコア反映とフィーバー突入音をまとめて行う */
  const applyToScore = useCallback((judgment: Judgment, kind: NoteKind) => {
    const before = scoreRef.current;
    scoreRef.current = applyJudgment(before, judgment, kind);
    if (!isFever(before.combo) && isFever(scoreRef.current.combo)) {
      audioRef.current?.playFeverStart();
    }
  }, []);

  const buildNoteViews = useCallback((chart: Chart, timeSec: number): NoteView[] => {
    const approachSec = beatToTime(APPROACH_BEATS, chart.bpm);
    const views: NoteView[] = [];
    for (const note of chart.notes) {
      const result = judgedRef.current[note.id];
      // ヒット済み・回避済みノーツは消す。ミスは流れ去るまで表示する
      if (result !== null && result !== 'miss') continue;
      const progress = (note.time - timeSec) / approachSec;
      if (progress > 1.05 || progress < -0.4) continue;
      views.push({ id: note.id, progress, kind: note.kind, missed: result === 'miss' });
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

    // 通り過ぎたノーツを処理する(通常=ミス、おじゃま=回避成功)
    for (const note of chart.notes) {
      if (judgedRef.current[note.id] === null && timeSec > note.time + MISS_WINDOW) {
        if (note.kind === 'bomb') {
          judgedRef.current[note.id] = 'avoided';
          continue;
        }
        judgedRef.current[note.id] = 'miss';
        applyToScore('miss', note.kind);
        pushJudgment('miss');
        audio.playHit('miss');
      }
    }

    // 伴奏を先読みでスケジュールする
    const events = musicEventsRef.current;
    while (
      musicIndexRef.current < events.length &&
      events[musicIndexRef.current].time < timeSec + LOOKAHEAD_SEC
    ) {
      const event = events[musicIndexRef.current];
      audio.playMusicEvent(event, startAtRef.current + event.time);
      musicIndexRef.current += 1;
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
  }, [applyToScore, buildNoteViews, finish, pushJudgment]);

  const start = useCallback(
    (stage: StageDef) => {
      const audio = (audioRef.current ??= new GameAudio());
      audio.ensure();
      const chart = createStageChart(stage);
      chartRef.current = chart;
      musicEventsRef.current = buildMusicEvents(chart, stage.music);
      musicIndexRef.current = 0;
      judgedRef.current = chart.notes.map(() => null);
      scoreRef.current = createScoreState();
      lastJudgmentRef.current = null;
      startAtRef.current = audio.currentTime + LEAD_IN_SEC;
      phaseRef.current = 'playing';
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(frame);
    },
    [frame],
  );

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
    if (index === -1) {
      audio.playEmptyTap();
      return;
    }

    const note = chart.notes[index];

    // おじゃまノーツを叩いてしまった!
    if (note.kind === 'bomb') {
      judgedRef.current[note.id] = 'miss';
      applyToScore('miss', 'normal');
      pushJudgment('miss', null, true);
      audio.playExplosion();
      return;
    }

    const offset = timeSec - note.time;
    const judgment = judgeOffset(offset);
    if (judgment === null) return;

    judgedRef.current[note.id] = judgment;
    applyToScore(judgment, note.kind);
    pushJudgment(judgment, judgment === 'good' ? (offset < 0 ? 'early' : 'late') : null);
    audio.playHit(judgment, note.kind === 'star');
  }, [applyToScore, pushJudgment]);

  const backToTitle = useCallback(() => {
    phaseRef.current = 'title';
    cancelAnimationFrame(rafRef.current);
    setSnapshot(initialSnapshot());
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return { snapshot, start, hit, backToTitle };
}
