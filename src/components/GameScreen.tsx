import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import type {
  GameSnapshot,
  JudgmentEvent,
  NoteView,
  PlayerSnapshot,
} from '../hooks/useGameEngine';
import type { StageDef } from '../game/stages';
import { BEATS_PER_MEASURE, COUNT_IN_BEATS } from '../game/chart';
import { ENDLESS_LIVES } from '../game/endless';
import { calcAccuracy, calcRank, isFever } from '../game/score';
import {
  PLAYER_CHARACTERS,
  PLAYER_COLORS,
  PLAYER_KEY_LABELS,
  PLAYER_LABELS,
} from '../game/versus';
import { JUDGMENT_LABEL } from '../game/types';

/** オンライン対戦相手のスコア実況 */
export interface RivalView {
  id: string;
  name: string;
  slot: number;
  score: number;
  combo: number;
}

interface Props {
  snapshot: GameSnapshot;
  stage: StageDef;
  onHit: (player?: number) => void;
  /** オンライン対戦中の相手たち(オフラインでは undefined) */
  rivals?: readonly RivalView[];
}

/** ヒットゾーンの横位置(%) */
const HIT_X = 18;
/** ノーツ出現位置の横位置(%) */
const SPAWN_X = 94;

/** 暗記ステージでノーツが消え始める progress */
const VANISH_START = 0.45;
/** 完全に見えなくなる progress */
const VANISH_END = 0.25;

/** とつぜんステージでノーツが見え始める progress */
const SUDDEN_SHOW = 0.5;
/** 完全に見える progress */
const SUDDEN_FULL = 0.38;

/** 観客の最大数 */
const MAX_AUDIENCE = 6;

const HINT_LABEL = { early: 'はやい!', late: 'おそい!' } as const;

export function themeStyle(stage: StageDef): CSSProperties {
  return {
    '--bg-top': stage.theme.bgTop,
    '--bg-bottom': stage.theme.bgBottom,
    '--ink': stage.theme.ink,
    '--accent': stage.theme.accent,
    '--lane': stage.theme.lane,
  } as CSSProperties;
}

function noteOpacity(stage: StageDef, progress: number, kind: string, missed: boolean) {
  // おじゃまノーツとミスして流れたノーツはギミック対象外で常に見える
  if (kind === 'bomb' || missed || progress < 0) return undefined;
  // 暗記ステージ: ヒットゾーン手前で消える
  if (stage.hideNotes) {
    return Math.max(0, Math.min(1, (progress - VANISH_END) / (VANISH_START - VANISH_END)));
  }
  // とつぜんステージ: ヒットゾーン直前まで見えない
  if (stage.suddenNotes) {
    return Math.max(0, Math.min(1, (SUDDEN_SHOW - progress) / (SUDDEN_SHOW - SUDDEN_FULL)));
  }
  return undefined;
}

/** ノーツが流れる形式のレーン1本分(1Pでも対戦の各プレイヤーでも使う) */
function FlowLane({
  stage,
  notes,
  lastJudgment,
  beatPulse,
  character,
  className = '',
  style,
  onTap,
  children,
}: {
  stage: StageDef;
  notes: NoteView[];
  lastJudgment: JudgmentEvent | null;
  beatPulse: number;
  character: string;
  className?: string;
  style?: CSSProperties;
  onTap?: (e: PointerEvent<HTMLDivElement>) => void;
  children?: ReactNode;
}) {
  // 逆走ステージではヒットゾーンが右、ノーツは左から流れる
  const hitX = stage.reverse ? 100 - HIT_X : HIT_X;
  const span = (stage.reverse ? -1 : 1) * (SPAWN_X - HIT_X);
  return (
    <div className={`stage ${className}`} style={style} onPointerDown={onTap}>
      <div className="lane" />
      <div
        className="hit-zone"
        style={{ left: `${hitX}%`, transform: `translate(-50%, -50%) scale(${beatPulse})` }}
      />
      <div
        className="character"
        style={{ left: `${hitX}%` }}
        key={lastJudgment ? `chara-${lastJudgment.seq}` : 'chara'}
        data-judgment={lastJudgment?.type ?? 'none'}
      >
        {character}
      </div>
      {notes.map((note) => (
        <div
          key={note.id}
          className={`note${note.missed ? ' note-missed' : ''}${
            note.kind === 'star' ? ' note-star' : ''
          }${note.kind === 'bomb' ? ' note-bomb' : ''}`}
          style={{
            left: `${hitX + note.progress * span}%`,
            opacity: noteOpacity(stage, note.progress, note.kind, note.missed),
          }}
        >
          {note.kind === 'star'
            ? stage.starEmoji
            : note.kind === 'bomb'
              ? '💣'
              : stage.noteEmoji}
        </div>
      ))}
      {lastJudgment && (
        <div
          key={`judge-${lastJudgment.seq}`}
          className={`judgment-label judgment-${lastJudgment.type}${
            lastJudgment.bomb ? ' judgment-bomb' : ''
          }`}
          style={{ left: `${hitX}%` }}
        >
          {lastJudgment.bomb ? '💥 ドカーン!' : JUDGMENT_LABEL[lastJudgment.type]}
          {lastJudgment.hint && (
            <span className="judgment-hint">{HINT_LABEL[lastJudgment.hint]}</span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/** コール&レスポンス(echo)ステージの中央パネル */
function EchoStage({
  stage,
  beat,
  lastJudgment,
}: {
  stage: StageDef;
  beat: number;
  lastJudgment: JudgmentEvent | null;
}) {
  const musicBeat = beat - COUNT_IN_BEATS;
  const measure = Math.floor(musicBeat / BEATS_PER_MEASURE);
  const inMeasure = musicBeat - measure * BEATS_PER_MEASURE;
  const started = measure >= 0;
  const isCall = started && measure % 2 === 0;
  const patternIndex = isCall ? measure + 1 : measure;
  const pattern =
    started && patternIndex >= 0 && patternIndex < stage.patterns.length
      ? stage.patterns[patternIndex]
      : [];
  const starOffsets =
    started && patternIndex >= 0 && patternIndex < stage.stars.length
      ? stage.stars[patternIndex]
      : [];
  // コール中はお手本が鳴った音符から順に表示、レスポンス中は全部薄く見せる
  const poppedCount = isCall
    ? pattern.filter((o) => o <= inMeasure + 0.001).length
    : pattern.length;

  return (
    <div className="stage echo-stage">
      <div
        className="echo-teacher"
        key={isCall ? `call-${measure}-${poppedCount}` : `idle-${measure}`}
        data-calling={isCall && poppedCount > 0}
      >
        {stage.character}
      </div>
      <div className="echo-notes">
        {pattern.map((offset, i) => (
          <span
            key={`${patternIndex}-${i}`}
            className={`echo-note${i < poppedCount ? ' echo-note-on' : ''}${
              isCall ? '' : ' echo-note-ghost'
            }`}
          >
            {starOffsets.includes(offset) ? stage.starEmoji : stage.noteEmoji}
          </span>
        ))}
      </div>
      <div className="echo-phase">
        {!started ? '' : isCall ? '🎧 よくきいて!' : '🎤 きみのばん!'}
      </div>
      <div className="beat-dots">
        {Array.from({ length: BEATS_PER_MEASURE }, (_, d) => (
          <span
            key={d}
            className={`dot${started && d === Math.floor(inMeasure) ? ' dot-on' : ''}`}
          />
        ))}
      </div>
      <div
        className="echo-player"
        key={lastJudgment ? `player-${lastJudgment.seq}` : 'player'}
        data-judgment={lastJudgment?.type ?? 'none'}
      >
        🐥
      </div>
      {lastJudgment && (
        <div
          key={`judge-${lastJudgment.seq}`}
          className={`judgment-label judgment-${lastJudgment.type}`}
        >
          {JUDGMENT_LABEL[lastJudgment.type]}
          {lastJudgment.hint && (
            <span className="judgment-hint">
              {HINT_LABEL[lastJudgment.hint]}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function footerText(stage: StageDef, isVersus: boolean, playerCount: number): string {
  if (isVersus) {
    const keys = PLAYER_LABELS.slice(0, playerCount)
      .map((label, i) => `${label}:${PLAYER_KEY_LABELS[i]}`)
      .join(' ');
    return `じぶんの レーンを タップ! キーは ${keys}`;
  }
  if (stage.gameSystem === 'echo') {
    return 'おてほんの つぎの小節で おなじリズムを たたこう!';
  }
  if (stage.hideNotes) return 'きえても リズムは つづいてる! 💣 は たたかない!';
  if (stage.suddenNotes) return 'ノーツは とつぜん あらわれる! おとを よく きこう!';
  if (stage.reverse) return 'こんどは ひだりから ながれてくる! 💣 は たたかない!';
  return 'スペース か タップで たたく! 💣 は たたかない!';
}

export function GameScreen({ snapshot, stage, onHit, rivals }: Props) {
  const { score, lastJudgment, countIn, beat, bpm, mode, lives, round, speedUp, players } =
    snapshot;
  const isVersus = mode === 'versus';
  const beatPulse = 1 + 0.04 * Math.max(0, 1 - (beat % 1) * 3);
  const fever = players.some((p) => isFever(p.score.combo));

  const totalJudged = score.counts.perfect + score.counts.good + score.counts.miss;
  const accuracy = totalJudged === 0 ? 1 : calcAccuracy(score.counts);
  const grooveLevel = calcRank(accuracy);

  const bestCombo = Math.max(0, ...players.map((p) => p.score.combo));
  const audienceCount = Math.min(MAX_AUDIENCE, 2 + Math.floor(bestCombo / 4));
  const beatSec = 60 / bpm;

  return (
    <div
      className={`screen game-screen${fever ? ' fever' : ''}`}
      style={themeStyle(stage)}
      onPointerDown={(e) => {
        // 対戦ではレーンごとのタップで叩く(画面全体タップは1P用)
        if (isVersus) return;
        e.preventDefault();
        onHit(0);
      }}
    >
      <header className="hud">
        <div className="hud-score">
          {isVersus ? `👥 ${players.length}にん たいせん` : `スコア ${score.score}`}
        </div>
        <div className="hud-stage">
          {mode === 'endless' ? `🎪 ラウンド ${round + 1} ♪=${bpm}` : stage.title}
        </div>
        <div className="hud-combo">
          {!isVersus && score.combo >= 2
            ? `${isFever(score.combo) ? '🔥' : ''}${score.combo} コンボ!`
            : ''}
        </div>
      </header>

      <div className="hud-sub">
        {!isVersus && (
          <div className="groove-gauge" title="ノリゲージ">
            <span className="groove-label">ノリ</span>
            <div className="groove-track">
              <div
                className="groove-fill"
                data-level={grooveLevel}
                style={{ width: `${accuracy * 100}%` }}
              />
            </div>
          </div>
        )}
        {mode === 'endless' && lives !== null && (
          <div className="lives">
            {'❤️'.repeat(lives)}
            {'🖤'.repeat(Math.max(0, ENDLESS_LIVES - lives))}
          </div>
        )}
        {rivals !== undefined && rivals.length > 0 && (
          <div className="rivals">
            {rivals.map((rival) => (
              <span
                key={rival.id}
                className="rival"
                style={{ '--player-accent': PLAYER_COLORS[rival.slot % 4] } as CSSProperties}
              >
                {PLAYER_CHARACTERS[rival.slot % 4]} {rival.name} {rival.score}
                {rival.combo >= 2 ? ` 🔗${rival.combo}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      {countIn !== null && <div className="count-in">{countIn}</div>}
      {fever && <div className="fever-banner">🔥 フィーバー!! 🔥</div>}
      {mode === 'endless' && speedUp && (
        <div key={`speed-${speedUp.seq}`} className="speed-up">
          ⏫ スピードアップ! ♪={speedUp.bpm}
        </div>
      )}

      {isVersus ? (
        <div className="versus-stages" data-players={players.length}>
          {players.map((player: PlayerSnapshot, i: number) => (
            <FlowLane
              key={i}
              className="versus-lane"
              style={{ '--player-accent': PLAYER_COLORS[i] } as CSSProperties}
              stage={stage}
              notes={player.notes}
              lastJudgment={player.lastJudgment}
              beatPulse={beatPulse}
              character={PLAYER_CHARACTERS[i]}
              onTap={(e) => {
                e.preventDefault();
                onHit(i);
              }}
            >
              <span className="versus-tag">
                {PLAYER_LABELS[i]} <kbd>{PLAYER_KEY_LABELS[i]}</kbd>
              </span>
              <span className="versus-points">
                {player.score.score}
                {player.score.combo >= 2 && (
                  <em className="versus-combo">
                    {isFever(player.score.combo) ? '🔥' : ''}
                    {player.score.combo}コンボ
                  </em>
                )}
              </span>
            </FlowLane>
          ))}
        </div>
      ) : stage.gameSystem === 'echo' ? (
        <EchoStage stage={stage} beat={beat} lastJudgment={lastJudgment} />
      ) : (
        <FlowLane
          stage={stage}
          notes={snapshot.notes}
          lastJudgment={lastJudgment}
          beatPulse={beatPulse}
          character={stage.character}
        />
      )}

      <div className={`audience${fever ? ' audience-fever' : ''}`}>
        {Array.from({ length: audienceCount }, (_, i) => (
          <span
            key={i}
            className="audience-member"
            style={{
              animationDuration: `${beatSec}s`,
              animationDelay: `${(i % 3) * 0.12}s`,
            }}
          >
            {stage.audience[i % stage.audience.length]}
          </span>
        ))}
      </div>

      <footer className="game-footer">{footerText(stage, isVersus, players.length)}</footer>
    </div>
  );
}
