import type { CSSProperties } from 'react';
import type { ScoreState } from '../game/score';
import { PLACE_EMOJI, PLAYER_CHARACTERS, PLAYER_COLORS } from '../game/versus';
import type { OnlineState } from '../online/useOnlineRoom';

interface Props {
  score: ScoreState;
  online: OnlineState;
  onLobby: () => void;
  onLeave: () => void;
}

/** オンライン対戦のリザルト。全員が終わるまでは待機表示 */
export function OnlineResultScreen({ score, online, onLobby, onLeave }: Props) {
  const { standings, selfId } = online;
  const disconnected = online.status === 'idle';

  return (
    <div className="screen result-screen">
      <h2 className="result-heading">🌐 オンラインたいせん</h2>

      {standings ? (
        <>
          <div className="result-rank result-rank-high">
            {standings.length === 1
              ? 'おつかれさま!'
              : standings.every((s) => s.rank === 0)
                ? '🤝 ひきわけ!'
                : `👑 ${standings
                    .filter((s) => s.rank === 0)
                    .map((s) => s.name)
                    .join(' と ')} の かち!`}
          </div>
          <ol className="versus-standings">
            {standings.map((s) => (
              <li
                key={s.id}
                className="versus-standing-row"
                style={{ '--player-accent': PLAYER_COLORS[s.slot % 4] } as CSSProperties}
                data-winner={s.rank === 0}
              >
                <span className="versus-standing-place">{PLACE_EMOJI[Math.min(s.rank, 3)]}</span>
                <span className="versus-standing-chara">{PLAYER_CHARACTERS[s.slot % 4]}</span>
                <span className="versus-standing-label">
                  {s.name}
                  {s.id === selfId ? ' (きみ)' : ''}
                </span>
                <span className="versus-standing-score">{s.score}</span>
                <span className="versus-standing-combo">さいだい {s.maxCombo} コンボ</span>
              </li>
            ))}
          </ol>
        </>
      ) : disconnected ? (
        <>
          <div className="result-rank result-rank-retry">せつだんされたよ…</div>
          <div className="result-score">きみのスコア {score.score}</div>
        </>
      ) : (
        <>
          <div className="result-rank result-rank-ok">みんなを まってるよ…</div>
          <div className="result-score">きみのスコア {score.score}</div>
        </>
      )}

      <div className="result-buttons">
        {!disconnected && standings && (
          <button className="start-button" onClick={onLobby}>
            ロビーへ もどる
          </button>
        )}
        <button className="sub-button" onClick={onLeave}>
          へやを でる
        </button>
      </div>
    </div>
  );
}
