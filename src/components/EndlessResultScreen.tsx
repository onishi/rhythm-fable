import type { ScoreState } from '../game/score';
import type { EndlessRecord } from '../game/progress';

interface Props {
  score: ScoreState;
  /** 到達ラウンド(1始まり) */
  round: number;
  record: EndlessRecord | null;
  newRecord: boolean;
  onRetry: () => void;
  onBackToSelect: () => void;
}

export function EndlessResultScreen({
  score,
  round,
  record,
  newRecord,
  onRetry,
  onBackToSelect,
}: Props) {
  return (
    <div className="screen result-screen">
      <h2 className="result-heading">🎪 とことんライブ おわり!</h2>
      <div className="result-rank result-rank-high">ラウンド {round} とうたつ</div>
      <div className="result-score">
        スコア {score.score}
        {newRecord && <span className="result-badge result-badge-record">ハイスコア!</span>}
      </div>
      {record && (
        <p className="result-endless-best">
          これまでのベスト: スコア {record.bestScore} / ラウンド {record.bestRound}
        </p>
      )}
      <dl className="result-counts">
        <div>
          <dt>ピタッ!</dt>
          <dd>{score.counts.perfect}</dd>
        </div>
        <div>
          <dt>まずまず</dt>
          <dd>{score.counts.good}</dd>
        </div>
        <div>
          <dt>あちゃー</dt>
          <dd>{score.counts.miss}</dd>
        </div>
        <div>
          <dt>さいだいコンボ</dt>
          <dd>{score.maxCombo}</dd>
        </div>
      </dl>
      <div className="result-buttons">
        <button className="start-button" onClick={onRetry}>
          もういちど!
        </button>
        <button className="sub-button" onClick={onBackToSelect}>
          ステージセレクト
        </button>
      </div>
      <p className="title-hint">スペースキーで もういちど ちょうせん!</p>
    </div>
  );
}
