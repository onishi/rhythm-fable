import { useState } from 'react';
import type { StageDef } from '../game/stages';
import { PLAYER_CHARACTERS } from '../game/versus';
import { ROOM_CODE_LENGTH, MAX_NAME_LENGTH } from '../online/protocol';
import type { OnlineRoom } from '../online/useOnlineRoom';

interface Props {
  online: OnlineRoom;
  stages: readonly StageDef[];
  onBack: () => void;
  /**
   * 画面のタップごとに呼ばれ、オーディオの自動再生制限を解除する。
   * ゲーム開始はサーバー合図(非ジェスチャ)なので、ロビーのうちに解錠しておく。
   */
  onInteract: () => void;
}

const NAME_KEY = 'rhythm-fable-name-v1';

function loadName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string): void {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // 保存できなくてもゲームは続行
  }
}

/** オンライン対戦のメニュー(部屋を作る/はいる)とロビー */
export function OnlineScreen({ online, stages, onBack, onInteract }: Props) {
  const { state } = online;
  const [name, setName] = useState(loadName);
  const [codeInput, setCodeInput] = useState('');
  const [stageId, setStageId] = useState(stages[0].id);

  const commitName = () => {
    saveName(name);
    return name;
  };

  if (state.status === 'connecting') {
    return (
      <div className="screen online-screen" onPointerDown={onInteract}>
        <h2 className="result-heading">🌐 せつぞくちゅう…</h2>
      </div>
    );
  }

  if (state.status === 'lobby' && state.room) {
    const room = state.room;
    const isHost = room.hostId === state.selfId;
    const self = room.players.find((p) => p.id === state.selfId);
    const othersReady =
      room.players.length >= 2 &&
      room.players.every((p) => p.id === room.hostId || p.ready);
    return (
      <div className="screen online-screen" onPointerDown={onInteract}>
        <h2 className="result-heading">🌐 オンラインたいせん</h2>
        <div className="room-code">
          あいことば: <strong>{room.code}</strong>
        </div>
        <p className="title-subtitle">おともだちに あいことばを おしえてね (さいだい4にん)</p>

        <ul className="online-players">
          {room.players.map((p) => (
            <li key={p.id} className="online-player" data-self={p.id === state.selfId}>
              <span className="online-player-chara">{PLAYER_CHARACTERS[p.slot % 4]}</span>
              <span className="online-player-name">
                {p.name}
                {p.id === state.selfId ? ' (きみ)' : ''}
              </span>
              <span className="online-player-state">
                {p.id === room.hostId ? '👑 ホスト' : p.ready ? '✅ じゅんびOK' : 'まってるよ…'}
              </span>
            </li>
          ))}
        </ul>

        {isHost ? (
          <>
            <div className="online-stage-pick">
              {stages.map((stage) => (
                <button
                  type="button"
                  key={stage.id}
                  className={`online-stage-chip${stage.id === stageId ? ' online-stage-chip-on' : ''}`}
                  onClick={() => setStageId(stage.id)}
                >
                  {stage.character} {stage.title}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="start-button"
              disabled={!othersReady}
              onClick={() => online.startGame(stageId)}
            >
              {room.players.length < 2
                ? 'おともだちを まってるよ…'
                : othersReady
                  ? 'みんなでスタート!'
                  : 'みんなの じゅんびを まってるよ…'}
            </button>
          </>
        ) : (
          <>
            <p className="title-subtitle">ホストが ステージを えらぶよ</p>
            <button
              type="button"
              className="start-button"
              onClick={() => online.setReady(!(self?.ready ?? false))}
            >
              {self?.ready ? 'じゅんび やめる' : 'じゅんび OK!'}
            </button>
          </>
        )}

        <button
          type="button"
          className="sub-button"
          onClick={() => {
            online.leave();
            onBack();
          }}
        >
          へやを でる
        </button>
      </div>
    );
  }

  // idle(メニュー)
  return (
    <div className="screen online-screen" onPointerDown={onInteract}>
      <h2 className="result-heading">🌐 オンラインで あそぶ</h2>
      <p className="title-subtitle">
        はなれた おともだちと おなじ きょくで スコアしょうぶ!
      </p>
      {state.error && <p className="online-error">⚠️ {state.error}</p>}

      <label className="online-field">
        なまえ
        <input
          className="online-input"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          placeholder="ゲスト"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="online-menu">
        <div className="online-menu-box">
          <h3>へやを つくる</h3>
          <p>あいことばが もらえるよ</p>
          <button
            type="button"
            className="start-button"
            onClick={() => void online.createRoom(commitName())}
          >
            つくる
          </button>
        </div>
        <div className="online-menu-box">
          <h3>へやに はいる</h3>
          <input
            className="online-input online-code-input"
            value={codeInput}
            maxLength={ROOM_CODE_LENGTH}
            placeholder="あいことば"
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          />
          <button
            type="button"
            className="start-button"
            disabled={codeInput.length !== ROOM_CODE_LENGTH}
            onClick={() => online.joinRoom(codeInput, commitName())}
          >
            はいる
          </button>
        </div>
      </div>

      <button type="button" className="sub-button" onClick={onBack}>
        タイトルへ もどる
      </button>
    </div>
  );
}
