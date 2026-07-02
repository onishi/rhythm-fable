import type { ScoreState, Rank } from '../game/score';
import { RANK_LABEL, isPerfectPlay } from '../game/score';
import type { StageDef } from '../game/stages';
import { themeStyle } from './GameScreen';

interface Props {
  stage: StageDef;
  score: ScoreState;
  rank: Rank;
  newRecord: boolean;
  unlockedNext: boolean;
  onRetry: () => void;
  onBackToSelect: () => void;
}

export function ResultScreen({
  stage,
  score,
  rank,
  newRecord,
  unlockedNext,
  onRetry,
  onBackToSelect,
}: Props) {
  return (
    <div className="screen result-screen" style={themeStyle(stage)}>
      <h2 className="result-heading">
        {stage.character} {stage.title} けっか はっぴょう!
      </h2>
      <div className={`result-rank result-rank-${rank}`}>{RANK_LABEL[rank]}</div>
      {isPerfectPlay(score.counts) && (
        <div className="result-badge result-badge-perfect">✨ パーフェクト!! ✨</div>
      )}
      <div className="result-score">
        スコア {score.score}
        {newRecord && <span className="result-badge result-badge-record">ハイスコア!</span>}
      </div>
      {unlockedNext && (
        <div className="result-unlock">🎉 つぎのステージが あそべるように なった!</div>
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
      <p className="title-hint">スペースキーで もういちど あそべるよ</p>
    </div>
  );
}
