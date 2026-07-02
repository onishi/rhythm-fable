import { RANK_LABEL } from '../game/score';
import type { EndlessRecord, Records } from '../game/progress';
import type { StageDef } from '../game/stages';

interface Props {
  stages: readonly StageDef[];
  records: Records;
  unlocked: readonly boolean[];
  endlessUnlocked: boolean;
  endlessRecord: EndlessRecord | null;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onStart: (index: number) => void;
}

export function StageSelect({
  stages,
  records,
  unlocked,
  endlessUnlocked,
  endlessRecord,
  selectedIndex,
  onSelect,
  onStart,
}: Props) {
  const endlessIndex = stages.length;
  const selectedIsEndless = selectedIndex === endlessIndex;
  const selectedCanStart = selectedIsEndless ? endlessUnlocked : unlocked[selectedIndex];
  return (
    <div className="screen title-screen">
      <h1 className="title-logo">
        リズム<span className="title-logo-accent">Fable</span>
      </h1>
      <p className="title-subtitle">どうぶつたちと リズムであそぼう!</p>

      <div className="stage-list">
        {stages.map((stage, index) => {
          const record = records[stage.id];
          const isLocked = !unlocked[index];
          return (
            <button
              type="button"
              key={stage.id}
              className={`stage-card${index === selectedIndex ? ' stage-card-selected' : ''}${
                isLocked ? ' stage-card-locked' : ''
              }`}
              onClick={() => {
                onSelect(index);
              }}
            >
              <span className="stage-card-character">{isLocked ? '🔒' : stage.character}</span>
              <span className="stage-card-medals">
                {record?.bestRank === 'high' ? '🏆' : ''}
                {record && record.perfectCount > 0 ? '✨' : ''}
              </span>
              <span className="stage-card-title">{stage.title}</span>
              <span className="stage-card-subtitle">
                {isLocked ? 'まえのステージを クリアしよう' : stage.subtitle}
              </span>
              <span className="stage-card-meta">
                {isLocked ? '???' : `BPM ${stage.bpm}`}
              </span>
              <span className="stage-card-record">
                {record
                  ? `ベスト ${record.bestScore} / ${RANK_LABEL[record.bestRank]}`
                  : isLocked
                    ? ''
                    : 'きろく なし'}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          className={`stage-card stage-card-endless${
            selectedIndex === endlessIndex ? ' stage-card-selected' : ''
          }${endlessUnlocked ? '' : ' stage-card-locked'}`}
          onClick={() => {
            onSelect(endlessIndex);
          }}
        >
          <span className="stage-card-character">{endlessUnlocked ? '🎪' : '🔒'}</span>
          <span className="stage-card-medals">
            {endlessRecord && endlessRecord.bestRound >= 10 ? '👑' : ''}
          </span>
          <span className="stage-card-title">とことんライブ</span>
          <span className="stage-card-subtitle">
            {endlessUnlocked
              ? 'どんどん はやくなる! ライフ3の サバイバル'
              : 'ぜんぶの ステージを クリアで かいほう'}
          </span>
          <span className="stage-card-meta">{endlessUnlocked ? 'エンドレス' : '???'}</span>
          <span className="stage-card-record">
            {endlessRecord
              ? `ベスト ${endlessRecord.bestScore} / ラウンド ${endlessRecord.bestRound}`
              : endlessUnlocked
                ? 'きろく なし'
                : ''}
          </span>
        </button>
      </div>

      <button
        type="button"
        className="start-button"
        disabled={!selectedCanStart}
        onClick={() => onStart(selectedIndex)}
      >
        {selectedCanStart ? 'このステージでスタート' : 'まだロック中'}
      </button>

      <div className="title-howto">
        <p>
          ノーツが どうぶつのところに きたら <kbd>スペース</kbd> か タップ!
          <br />
          ⭐ は とくてん2ばい / 💣 は たたいちゃダメ / 10コンボで 🔥フィーバー!
        </p>
      </div>
      <p className="title-hint">タップ / ←→ でえらんで スペースキーでスタート</p>
    </div>
  );
}
