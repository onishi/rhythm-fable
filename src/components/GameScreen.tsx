import type { CSSProperties } from 'react';
import type { GameSnapshot } from '../hooks/useGameEngine';
import type { StageDef } from '../game/stages';
import { isFever } from '../game/score';
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

export function GameScreen({ snapshot, stage, onHit }: Props) {
  const { notes, score, lastJudgment, countIn, beat } = snapshot;
  const beatPulse = 1 + 0.04 * Math.max(0, 1 - (beat % 1) * 3);
  const fever = isFever(score.combo);

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
        <div className="hud-stage">{stage.title}</div>
        <div className="hud-combo">
          {score.combo >= 2 ? `${fever ? '🔥' : ''}${score.combo} コンボ!` : ''}
        </div>
      </header>

      {countIn !== null && <div className="count-in">{countIn}</div>}
      {fever && <div className="fever-banner">🔥 フィーバー!! 🔥</div>}

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

      <footer className="game-footer">
        {stage.hideNotes
          ? 'きえても リズムは つづいてる! 💣 は たたかない!'
          : 'スペース か タップで たたく! 💣 は たたかない!'}
      </footer>
    </div>
  );
}
