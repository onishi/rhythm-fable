import type { CSSProperties } from 'react';
import type { PlayerSnapshot } from '../hooks/useGameEngine';
import {
  PLACE_EMOJI,
  PLAYER_CHARACTERS,
  PLAYER_COLORS,
  PLAYER_LABELS,
  rankPlayers,
} from '../game/versus';

interface Props {
  players: readonly PlayerSnapshot[];
  onRetry: () => void;
  onBackToSelect: () => void;
}

export function VersusResultScreen({ players, onRetry, onBackToSelect }: Props) {
  const ranks = rankPlayers(players.map((p) => p.score.score));
  const order = players
    .map((_, i) => i)
    .sort((a, b) => ranks[a] - ranks[b] || a - b);
  const winners = ranks
    .map((rank, i) => ({ rank, i }))
    .filter((r) => r.rank === 0)
    .map((r) => r.i);
  const heading =
    winners.length === players.length
      ? '🤝 ひきわけ!'
      : `👑 ${winners.map((w) => PLAYER_LABELS[w]).join(' と ')} の かち!`;

  return (
    <div className="screen result-screen">
      <h2 className="result-heading">🏁 たいせん おわり!</h2>
      <div className="result-rank result-rank-high">{heading}</div>
      <ol className="versus-standings">
        {order.map((i) => (
          <li
            key={i}
            className="versus-standing-row"
            style={{ '--player-accent': PLAYER_COLORS[i] } as CSSProperties}
            data-winner={ranks[i] === 0}
          >
            <span className="versus-standing-place">{PLACE_EMOJI[ranks[i]]}</span>
            <span className="versus-standing-chara">{PLAYER_CHARACTERS[i]}</span>
            <span className="versus-standing-label">{PLAYER_LABELS[i]}</span>
            <span className="versus-standing-score">{players[i].score.score}</span>
            <span className="versus-standing-combo">
              さいだい {players[i].score.maxCombo} コンボ
            </span>
          </li>
        ))}
      </ol>
      <div className="result-buttons">
        <button className="start-button" onClick={onRetry}>
          もういちど!
        </button>
        <button className="sub-button" onClick={onBackToSelect}>
          ステージセレクト
        </button>
      </div>
      <p className="title-hint">スペースキーで もういちど しょうぶ!</p>
    </div>
  );
}
