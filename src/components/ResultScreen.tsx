import type { ScoreState, Rank } from '../game/score';
import { RANK_LABEL } from '../game/score';

interface Props {
  score: ScoreState;
  rank: Rank;
  onRetry: () => void;
  onBackToTitle: () => void;
}

export function ResultScreen({ score, rank, onRetry, onBackToTitle }: Props) {
  return (
    <div className="screen result-screen">
      <h2 className="result-heading">けっか はっぴょう!</h2>
      <div className={`result-rank result-rank-${rank}`}>{RANK_LABEL[rank]}</div>
      <div className="result-score">スコア {score.score}</div>
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
        <button className="sub-button" onClick={onBackToTitle}>
          タイトルへ
        </button>
      </div>
      <p className="title-hint">スペースキーで もういちど あそべるよ</p>
    </div>
  );
}
