import type { CSSProperties } from 'react';
import type { GameSnapshot } from '../hooks/useGameEngine';
import type { StageDef } from '../game/stages';
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

export function GameScreen({ snapshot, stage, onHit }: Props) {
  const { notes, score, lastJudgment, countIn, beat } = snapshot;
  const beatPulse = 1 + 0.04 * Math.max(0, 1 - (beat % 1) * 3);

  return (
    <div
      className="screen game-screen"
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
          {score.combo >= 2 ? `${score.combo} コンボ!` : ''}
        </div>
      </header>

      {countIn !== null && <div className="count-in">{countIn}</div>}

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
            }`}
            style={{ left: `${HIT_X + note.progress * (SPAWN_X - HIT_X)}%` }}
          >
            {note.kind === 'star' ? stage.starEmoji : stage.noteEmoji}
          </div>
        ))}
        {lastJudgment && (
          <div
            key={`judge-${lastJudgment.seq}`}
            className={`judgment-label judgment-${lastJudgment.type}`}
            style={{ left: `${HIT_X}%` }}
          >
            {JUDGMENT_LABEL[lastJudgment.type]}
            {lastJudgment.hint && (
              <span className="judgment-hint">{HINT_LABEL[lastJudgment.hint]}</span>
            )}
          </div>
        )}
      </div>

      <footer className="game-footer">スペース か タップで たたく!</footer>
    </div>
  );
}
