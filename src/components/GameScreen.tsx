import type { CSSProperties } from 'react';
import type { GameSnapshot, JudgmentEvent } from '../hooks/useGameEngine';
import type { StageDef } from '../game/stages';
import { BEATS_PER_MEASURE, COUNT_IN_BEATS } from '../game/chart';
import { ENDLESS_LIVES } from '../game/endless';
import { calcAccuracy, calcRank, isFever } from '../game/score';
import { JUDGMENT_LABEL } from '../game/types';

interface Props {
  snapshot: GameSnapshot;
  stage: StageDef;
  onHit: () => void;
}

/** ヒットゾーンの横位置(%) */
const HIT_X = 18;
/** ノーツ出現位置の横位置(%) */
const SPAWN_X = 94;

/** 暗記ステージでノーツが消え始める progress */
const VANISH_START = 0.45;
/** 完全に見えなくなる progress */
const VANISH_END = 0.25;

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
  // 暗記ステージでは通常/スターノーツがヒットゾーン手前で消える
  // (おじゃまノーツとミスして流れたノーツは見えたまま)
  if (!stage.hideNotes || kind === 'bomb' || missed || progress < 0) return undefined;
  return Math.max(0, Math.min(1, (progress - VANISH_END) / (VANISH_START - VANISH_END)));
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

export function GameScreen({ snapshot, stage, onHit }: Props) {
  const { notes, score, lastJudgment, countIn, beat, bpm, mode, lives, round, speedUp } =
    snapshot;
  const beatPulse = 1 + 0.04 * Math.max(0, 1 - (beat % 1) * 3);
  const fever = isFever(score.combo);

  const totalJudged = score.counts.perfect + score.counts.good + score.counts.miss;
  const accuracy = totalJudged === 0 ? 1 : calcAccuracy(score.counts);
  const grooveLevel = calcRank(accuracy);

  const audienceCount = Math.min(MAX_AUDIENCE, 2 + Math.floor(score.combo / 4));
  const beatSec = 60 / bpm;

  return (
    <div
      className={`screen game-screen${fever ? ' fever' : ''}`}
      style={themeStyle(stage)}
      onPointerDown={(e) => {
        e.preventDefault();
        onHit();
      }}
    >
      <header className="hud">
        <div className="hud-score">スコア {score.score}</div>
        <div className="hud-stage">
          {mode === 'endless' ? `🎪 ラウンド ${round + 1} ♪=${bpm}` : stage.title}
        </div>
        <div className="hud-combo">
          {score.combo >= 2 ? `${fever ? '🔥' : ''}${score.combo} コンボ!` : ''}
        </div>
      </header>

      <div className="hud-sub">
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
        {mode === 'endless' && lives !== null && (
          <div className="lives">
            {'❤️'.repeat(lives)}
            {'🖤'.repeat(Math.max(0, ENDLESS_LIVES - lives))}
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

      {stage.gameSystem === 'echo' ? (
        <EchoStage stage={stage} beat={beat} lastJudgment={lastJudgment} />
      ) : (
        <div className="stage">
          <div className="lane" />
          <div
            className="hit-zone"
            style={{ left: `${HIT_X}%`, transform: `translate(-50%, -50%) scale(${beatPulse})` }}
          />
          <div
            className="character"
            style={{ left: `${HIT_X}%` }}
            key={lastJudgment ? `chara-${lastJudgment.seq}` : 'chara'}
            data-judgment={lastJudgment?.type ?? 'none'}
          >
            {stage.character}
          </div>
          {notes.map((note) => (
            <div
              key={note.id}
              className={`note${note.missed ? ' note-missed' : ''}${
                note.kind === 'star' ? ' note-star' : ''
              }${note.kind === 'bomb' ? ' note-bomb' : ''}`}
              style={{
                left: `${HIT_X + note.progress * (SPAWN_X - HIT_X)}%`,
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
              style={{ left: `${HIT_X}%` }}
            >
              {lastJudgment.bomb ? '💥 ドカーン!' : JUDGMENT_LABEL[lastJudgment.type]}
              {lastJudgment.hint && (
                <span className="judgment-hint">{HINT_LABEL[lastJudgment.hint]}</span>
              )}
            </div>
          )}
        </div>
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

      <footer className="game-footer">
        {stage.gameSystem === 'echo'
          ? 'おてほんの つぎの小節で おなじリズムを たたこう!'
          : stage.hideNotes
            ? 'きえても リズムは つづいてる! 💣 は たたかない!'
            : 'スペース か タップで たたく! 💣 は たたかない!'}
      </footer>
    </div>
  );
}
