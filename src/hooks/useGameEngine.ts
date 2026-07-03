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
export type GameMode = 'normal' | 'endless' | 'versus';

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

/** 1プレイヤー分の表示状態 */
export interface PlayerSnapshot {
  notes: NoteView[];
  score: ScoreState;
  lastJudgment: JudgmentEvent | null;
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
  /** 1P の視点(players[0] と同じ内容。1Pモード用のショートカット) */
  notes: NoteView[];
  score: ScoreState;
  lastJudgment: JudgmentEvent | null;
  /** 全プレイヤーの状態(1Pモードでは長さ1) */
  players: PlayerSnapshot[];
  rank: Rank | null;
  /** エンドレスの残りライフ(通常モードは null) */
  lives: number | null;
  /** エンドレスの現在ラウンド(0始まり) */
  round: number;
  /** ラウンド切り替え演出用(通常モードは null) */
  speedUp: { bpm: number; seq: number } | null;
}

const COUNT_IN_TEXTS = ['いち', 'に', 'さん', 'ハイ!'];

/** エンジン内部の1プレイヤー分の状態 */
interface PlayerState {
  judged: (NoteResult | null)[];
  score: ScoreState;
  lastJudgment: JudgmentEvent | null;
}

function createPlayers(count: number, noteCount: number): PlayerState[] {
  return Array.from({ length: count }, () => ({
    judged: Array.from({ length: noteCount }, () => null),
    score: createScoreState(),
    lastJudgment: null,
  }));
}

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
    players: [],
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
  startVersus: (stage: StageDef, playerCount: number) => void;
  /** 引数はプレイヤー番号(省略時は1P) */
  hit: (player?: number) => void;
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
  const playersRef = useRef<PlayerState[]>([]);
  const judgmentSeqRef = useRef(0);
  const rafRef = useRef(0);
  const phaseRef = useRef<Phase>('title');
  const modeRef = useRef<GameMode>('normal');
  const livesRef = useRef(ENDLESS_LIVES);
  const roundRef = useRef(0);
  const rngRef = useRef<() => number>(() => 0);
  const speedUpRef = useRef<{ bpm: number; seq: number } | null>(null);

  const pushJudgment = useCallback(
    (player: PlayerState, type: Judgment, hint: TimingHint = null, bomb = false) => {
      judgmentSeqRef.current += 1;
      player.lastJudgment = { type, hint, bomb, seq: judgmentSeqRef.current };
    },
    [],
  );

  /** スコア反映とフィーバー突入音をまとめて行う */
  const applyToScore = useCallback(
    (player: PlayerState, judgment: Judgment, kind: NoteKind) => {
      const before = player.score;
      player.score = applyJudgment(before, judgment, kind);
      if (!isFever(before.combo) && isFever(player.score.combo)) {
        audioRef.current?.playFeverStart();
      }
    },
    [],
  );

  const buildNoteViews = useCallback(
    (chart: Chart, timeSec: number, judged: readonly (NoteResult | null)[]): NoteView[] => {
      const approachSec = beatToTime(APPROACH_BEATS, chart.bpm);
      const views: NoteView[] = [];
      for (const note of chart.notes) {
        const result = judged[note.id];
        // ヒット済み・回避済みノーツは消す。ミスは流れ去るまで表示する
        if (result !== null && result !== 'miss') continue;
        const progress = (note.time - timeSec) / approachSec;
        if (progress > 1.05 || progress < -0.4) continue;
        views.push({ id: note.id, progress, kind: note.kind, missed: result === 'miss' });
      }
      return views;
    },
    [],
  );

  const buildPlayerSnapshots = useCallback(
    (chart: Chart | null, timeSec: number): PlayerSnapshot[] =>
      playersRef.current.map((player) => ({
        notes: chart ? buildNoteViews(chart, timeSec, player.judged) : [],
        score: player.score,
        lastJudgment: player.lastJudgment,
      })),
    [buildNoteViews],
  );

  const finish = useCallback(() => {
    phaseRef.current = 'result';
    const first = playersRef.current[0];
    const rank =
      modeRef.current === 'normal' ? calcRank(calcAccuracy(first.score.counts)) : null;
    audioRef.current?.playResultJingle(rank ?? 'ok');
    const players = buildPlayerSnapshots(null, 0);
    setSnapshot((prev) => ({
      ...prev,
      phase: 'result',
      notes: [],
      countIn: null,
      score: first.score,
      lastJudgment: first.lastJudgment,
      players,
      rank,
      lives: modeRef.current === 'endless' ? livesRef.current : null,
      round: roundRef.current,
    }));
  }, [buildPlayerSnapshots]);

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
    for (const player of playersRef.current) {
      player.judged = chart.notes.map(() => null);
    }
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
      if (timeSec <= note.time + MISS_WINDOW) continue;
      let playMissSound = false;
      for (const player of playersRef.current) {
        if (player.judged[note.id] !== null) continue;
        if (note.kind === 'bomb') {
          player.judged[note.id] = 'avoided';
          continue;
        }
        player.judged[note.id] = 'miss';
        applyToScore(player, 'miss', note.kind);
        pushJudgment(player, 'miss');
        playMissSound = true;
        if (loseLife()) {
          finish();
          return;
        }
      }
      // 複数プレイヤーが同時にミスしても効果音は1回だけ
      if (playMissSound) audio.playHit('miss');
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
    const players = buildPlayerSnapshots(chart, timeSec);
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
      notes: players[0].notes,
      score: players[0].score,
      lastJudgment: players[0].lastJudgment,
      players,
      rank: null,
      lives: modeRef.current === 'endless' ? livesRef.current : null,
      round: roundRef.current,
      speedUp: speedUpRef.current,
    });
    rafRef.current = requestAnimationFrame(frame);
  }, [
    applyToScore,
    buildPlayerSnapshots,
    finish,
    loseLife,
    nextEndlessRound,
    pushJudgment,
  ]);

  /** モード共通の初期化 */
  const boot = useCallback(
    (stage: StageDef, chart: Chart, musicEvents: MusicEvent[], playerCount = 1) => {
      const audio = (audioRef.current ??= new GameAudio());
      audio.ensure();
      stageRef.current = stage;
      chartRef.current = chart;
      musicEventsRef.current = musicEvents;
      musicIndexRef.current = 0;
      playersRef.current = createPlayers(playerCount, chart.notes.length);
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
      const melodyMode = stage.gameSystem === 'echo' ? 'callEcho' : 'onNote';
      boot(
        stage,
        chart,
        buildMusicEvents(chart, stage.music, COUNT_IN_BEATS, melodyMode),
      );
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

  const startVersus = useCallback(
    (stage: StageDef, playerCount: number) => {
      modeRef.current = 'versus';
      const chart = createStageChart(stage);
      boot(
        stage,
        chart,
        buildMusicEvents(chart, stage.music, COUNT_IN_BEATS),
        playerCount,
      );
    },
    [boot],
  );

  const hit = useCallback(
    (playerIndex = 0) => {
      const audio = audioRef.current;
      const chart = chartRef.current;
      const player = playersRef.current[playerIndex];
      if (!audio || !chart || !player || phaseRef.current !== 'playing') return;
      const timeSec = audio.currentTime - startAtRef.current;
      if (timeSec < 0) return;

      const index = findTargetNoteIndex(
        chart.notes.map((n) => n.time),
        player.judged,
        timeSec,
      );
      if (index === -1) {
        audio.playEmptyTap();
        return;
      }

      const note = chart.notes[index];

      // おじゃまノーツを叩いてしまった!
      if (note.kind === 'bomb') {
        player.judged[note.id] = 'miss';
        applyToScore(player, 'miss', 'normal');
        pushJudgment(player, 'miss', null, true);
        audio.playExplosion();
        if (loseLife()) finish();
        return;
      }

      const offset = timeSec - note.time;
      const judgment = judgeOffset(offset);
      if (judgment === null) return;

      player.judged[note.id] = judgment;
      applyToScore(player, judgment, note.kind);
      pushJudgment(
        player,
        judgment,
        judgment === 'good' ? (offset < 0 ? 'early' : 'late') : null,
      );
      audio.playHit(judgment, note.kind === 'star');
      if (judgment === 'miss' && loseLife()) finish();
    },
    [applyToScore, finish, loseLife, pushJudgment],
  );

  const backToTitle = useCallback(() => {
    phaseRef.current = 'title';
    cancelAnimationFrame(rafRef.current);
    setSnapshot(initialSnapshot());
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return { snapshot, start, startEndless, startVersus, hit, backToTitle };
}
