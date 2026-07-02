import type { GameSnapshot } from '../hooks/useGameEngine';
import { JUDGMENT_LABEL } from '../game/types';

interface Props {
  snapshot: GameSnapshot;
  onHit: () => void;
}

/** ヒットゾーンの横位置(%) */
const HIT_X = 18;
/** ノーツ出現位置の横位置(%) */
const SPAWN_X = 94;

export function GameScreen({ snapshot, onHit }: Props) {
  const { notes, score, lastJudgment, countIn, beat } = snapshot;
  const beatPulse = 1 + 0.04 * Math.max(0, 1 - (beat % 1) * 3);

  return (
    <div
      className="screen game-screen"
      onPointerDown={(e) => {
        e.preventDefault();
        onHit();
      }}
    >
      <header className="hud">
        <div className="hud-score">スコア {score.score}</div>
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
          key={lastJudgment ? `fox-${lastJudgment.seq}` : 'fox'}
          data-judgment={lastJudgment?.type ?? 'none'}
        >
          🦊
        </div>
        {notes.map((note) => (
          <div
            key={note.id}
            className={`note${note.missed ? ' note-missed' : ''}`}
            style={{ left: `${HIT_X + note.progress * (SPAWN_X - HIT_X)}%` }}
          >
            🎵
          </div>
        ))}
        {lastJudgment && (
          <div
            key={`judge-${lastJudgment.seq}`}
            className={`judgment-label judgment-${lastJudgment.type}`}
            style={{ left: `${HIT_X}%` }}
          >
            {JUDGMENT_LABEL[lastJudgment.type]}
          </div>
        )}
      </div>

      <footer className="game-footer">スペース か タップで たたく!</footer>
    </div>
  );
}
