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
import {
  ENDLESS_LIVES,
  buildEndlessRoundSpec,
  createEndlessRoundChart,
  mulberry32,
} from '../game/endless';
import { GameAudio } from '../game/audio';
import type { Judgment, NoteKind } from '../game/types';

export type Phase = 'title' | 'playing' | 'result';
export type GameMode = 'normal' | 'endless';

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
  mode: GameMode;
  /** 現在プレイ中のステージ(エンドレスではラウンドごとに変わる) */
  stage: StageDef | null;
  timeSec: number;
  /** 現在の拍(小数) */
  beat: number;
  bpm: number;
  /** カウントイン中の表示テキスト(それ以外は null) */
  countIn: string | null;
  notes: NoteView[];
  score: ScoreState;
  lastJudgment: JudgmentEvent | null;
  rank: Rank | null;
  /** エンドレスの残りライフ(通常モードは null) */
  lives: number | null;
  /** エンドレスの現在ラウンド(0始まり) */
  round: number;
  /** ラウンド切り替え演出用(通常モードは null) */
  speedUp: { bpm: number; seq: number } | null;
}

const COUNT_IN_TEXTS = ['いち', 'に', 'さん', 'ハイ!'];

function initialSnapshot(): GameSnapshot {
  return {
    phase: 'title',
    mode: 'normal',
    stage: null,
    timeSec: 0,
    beat: 0,
    bpm: 120,
    countIn: null,
    notes: [],
    score: createScoreState(),
    lastJudgment: null,
    rank: null,
    lives: null,
    round: 0,
    speedUp: null,
  };
}

export interface GameEngine {
  snapshot: GameSnapshot;
  start: (stage: StageDef) => void;
  startEndless: () => void;
  hit: () => void;
  backToTitle: () => void;
}

export function useGameEngine(): GameEngine {
  const [snapshot, setSnapshot] = useState<GameSnapshot>(initialSnapshot);

  const audioRef = useRef<GameAudio | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const stageRef = useRef<StageDef | null>(null);
  const musicEventsRef = useRef<MusicEvent[]>([]);
  const musicIndexRef = useRef(0);
  const startAtRef = useRef(0);
  const judgedRef = useRef<(NoteResult | null)[]>([]);
  const scoreRef = useRef<ScoreState>(createScoreState());
  const judgmentSeqRef = useRef(0);
  const lastJudgmentRef = useRef<JudgmentEvent | null>(null);
  const rafRef = useRef(0);
  const phaseRef = useRef<Phase>('title');
  const modeRef = useRef<GameMode>('normal');
  const livesRef = useRef(ENDLESS_LIVES);
  const roundRef = useRef(0);
  const rngRef = useRef<() => number>(() => 0);
  const speedUpRef = useRef<{ bpm: number; seq: number } | null>(null);

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
    const rank =
      modeRef.current === 'normal'
        ? calcRank(calcAccuracy(scoreRef.current.counts))
        : null;
    audioRef.current?.playResultJingle(rank ?? 'ok');
    setSnapshot((prev) => ({
      ...prev,
      phase: 'result',
      notes: [],
      countIn: null,
      score: scoreRef.current,
      rank,
      lives: modeRef.current === 'endless' ? livesRef.current : null,
      round: roundRef.current,
    }));
  }, []);

  /** エンドレスの次ラウンドをシームレスに始める */
  const nextEndlessRound = useCallback((prevLengthSec: number) => {
    roundRef.current += 1;
    const round = roundRef.current;
    const spec = buildEndlessRoundSpec(round, rngRef.current);
    const chart = createEndlessRoundChart(spec, round);
    stageRef.current = spec.stage;
    chartRef.current = chart;
    musicEventsRef.current = buildMusicEvents(chart, spec.stage.music, 0);
    musicIndexRef.current = 0;
    judgedRef.current = chart.notes.map(() => null);
    startAtRef.current += prevLengthSec;
    speedUpRef.current = { bpm: chart.bpm, seq: round };
  }, []);

  /** エンドレスでライフを1つ失う。ゲームオーバーなら true */
  const loseLife = useCallback((): boolean => {
    if (modeRef.current !== 'endless') return false;
    livesRef.current -= 1;
    return livesRef.current <= 0;
  }, []);

  const frame = useCallback(() => {
    const audio = audioRef.current;
    const chart = chartRef.current;
    const stage = stageRef.current;
    if (!audio || !chart || !stage || phaseRef.current !== 'playing') return;

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
        if (loseLife()) {
          finish();
          return;
        }
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
      if (modeRef.current === 'endless') {
        nextEndlessRound(chart.lengthSec);
        rafRef.current = requestAnimationFrame(frame);
        return;
      }
      finish();
      return;
    }

    // カウントイン表示は最初のラウンドのみ(エンドレスの2巡目以降は助走2拍だけ)
    const countInIndex = Math.floor(beat);
    setSnapshot({
      phase: 'playing',
      mode: modeRef.current,
      stage,
      timeSec,
      beat,
      bpm: chart.bpm,
      countIn:
        roundRef.current === 0 && beat >= 0 && countInIndex < COUNT_IN_BEATS
          ? COUNT_IN_TEXTS[countInIndex]
          : null,
      notes: buildNoteViews(chart, timeSec),
      score: scoreRef.current,
      lastJudgment: lastJudgmentRef.current,
      rank: null,
      lives: modeRef.current === 'endless' ? livesRef.current : null,
      round: roundRef.current,
      speedUp: speedUpRef.current,
    });
    rafRef.current = requestAnimationFrame(frame);
  }, [applyToScore, buildNoteViews, finish, loseLife, nextEndlessRound, pushJudgment]);

  /** モード共通の初期化 */
  const boot = useCallback(
    (stage: StageDef, chart: Chart, musicEvents: MusicEvent[]) => {
      const audio = (audioRef.current ??= new GameAudio());
      audio.ensure();
      stageRef.current = stage;
      chartRef.current = chart;
      musicEventsRef.current = musicEvents;
      musicIndexRef.current = 0;
      judgedRef.current = chart.notes.map(() => null);
      scoreRef.current = createScoreState();
      lastJudgmentRef.current = null;
      speedUpRef.current = null;
      roundRef.current = 0;
      startAtRef.current = audio.currentTime + LEAD_IN_SEC;
      phaseRef.current = 'playing';
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(frame);
    },
    [frame],
  );

  const start = useCallback(
    (stage: StageDef) => {
      modeRef.current = 'normal';
      const chart = createStageChart(stage);
      boot(stage, chart, buildMusicEvents(chart, stage.music));
    },
    [boot],
  );

  const startEndless = useCallback(() => {
    modeRef.current = 'endless';
    livesRef.current = ENDLESS_LIVES;
    rngRef.current = mulberry32(Date.now() >>> 0);
    const spec = buildEndlessRoundSpec(0, rngRef.current);
    const chart = createEndlessRoundChart(spec, 0);
    boot(spec.stage, chart, buildMusicEvents(chart, spec.stage.music));
  }, [boot]);

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
      if (loseLife()) finish();
      return;
    }

    const offset = timeSec - note.time;
    const judgment = judgeOffset(offset);
    if (judgment === null) return;

    judgedRef.current[note.id] = judgment;
    applyToScore(judgment, note.kind);
    pushJudgment(judgment, judgment === 'good' ? (offset < 0 ? 'early' : 'late') : null);
    audio.playHit(judgment, note.kind === 'star');
    if (judgment === 'miss' && loseLife()) finish();
  }, [applyToScore, finish, loseLife, pushJudgment]);

  const backToTitle = useCallback(() => {
    phaseRef.current = 'title';
    cancelAnimationFrame(rafRef.current);
    setSnapshot(initialSnapshot());
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return { snapshot, start, startEndless, hit, backToTitle };
}
