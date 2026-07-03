import { RANK_LABEL } from '../game/score';
import type { EndlessRecord, Records } from '../game/progress';
import type { StageDef } from '../game/stages';
import { MAX_PLAYERS, PLAYER_KEY_LABELS, PLAYER_LABELS, canPlayVersus } from '../game/versus';

interface Props {
  stages: readonly StageDef[];
  records: Records;
  unlocked: readonly boolean[];
  endlessUnlocked: boolean;
  endlessRecord: EndlessRecord | null;
  selectedIndex: number;
  playerCount: number;
  onSelect: (index: number) => void;
  onStart: (index: number) => void;
  onPlayerCount: (count: number) => void;
  onOnline: () => void;
}

const PLAYER_COUNT_LABELS = ['ひとり', 'ふたり', '3にん', '4にん'];

export function StageSelect({
  stages,
  records,
  unlocked,
  endlessUnlocked,
  endlessRecord,
  selectedIndex,
  playerCount,
  onSelect,
  onStart,
  onPlayerCount,
  onOnline,
}: Props) {
  const endlessIndex = stages.length;
  const versus = playerCount > 1;
  const selectedIsEndless = selectedIndex === endlessIndex;
  const selectedCanStart = selectedIsEndless
    ? endlessUnlocked && !versus
    : unlocked[selectedIndex] && (!versus || canPlayVersus(stages[selectedIndex]));

  return (
    <div className="screen title-screen">
      <h1 className="title-logo">
        リズム<span className="title-logo-accent">Fable</span>
      </h1>
      <p className="title-subtitle">どうぶつたちと リズムであそぼう!</p>

      <div className="player-count">
        <span className="player-count-label">👥 あそぶ にんずう</span>
        <div className="player-count-chips">
          {Array.from({ length: MAX_PLAYERS }, (_, i) => i + 1).map((n) => (
            <button
              type="button"
              key={n}
              className={`player-count-chip${playerCount === n ? ' player-count-chip-on' : ''}`}
              onClick={() => onPlayerCount(n)}
            >
              {PLAYER_COUNT_LABELS[n - 1]}
            </button>
          ))}
        </div>
        <button type="button" className="player-count-chip online-chip" onClick={onOnline}>
          🌐 オンラインで あそぶ
        </button>
      </div>

      <div className="stage-list">
        {stages.map((stage, index) => {
          const record = records[stage.id];
          const isLocked = !unlocked[index];
          const soloOnly = versus && !canPlayVersus(stage);
          return (
            <button
              type="button"
              key={stage.id}
              className={`stage-card${index === selectedIndex ? ' stage-card-selected' : ''}${
                isLocked || soloOnly ? ' stage-card-locked' : ''
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
                {isLocked
                  ? 'まえのステージを クリアしよう'
                  : soloOnly
                    ? 'このステージは ひとりせんよう'
                    : stage.subtitle}
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
          }${endlessUnlocked && !versus ? '' : ' stage-card-locked'}`}
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
            {!endlessUnlocked
              ? 'ぜんぶの ステージを クリアで かいほう'
              : versus
                ? 'このモードは ひとりせんよう'
                : 'どんどん はやくなる! ライフ3の サバイバル'}
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
        {selectedCanStart
          ? versus
            ? 'みんなでスタート'
            : 'このステージでスタート'
          : 'まだロック中'}
      </button>

      <div className="title-howto">
        {versus ? (
          <p>
            みんなで おなじきょくを たたいて スコアで しょうぶ!
            <br />
            {PLAYER_LABELS.slice(0, playerCount).map((label, i) => (
              <span key={label} className="player-key-hint">
                {label} <kbd>{PLAYER_KEY_LABELS[i]}</kbd>{' '}
              </span>
            ))}
            (タップなら じぶんの レーン)
          </p>
        ) : (
          <p>
            ノーツが どうぶつのところに きたら <kbd>スペース</kbd> か タップ!
            <br />
            ⭐ は とくてん2ばい / 💣 は たたいちゃダメ / 10コンボで 🔥フィーバー!
          </p>
        )}
      </div>
      <p className="title-hint">タップ / ←→ でえらんで スペースキーでスタート</p>
    </div>
  );
}
