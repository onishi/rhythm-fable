import { STAGES } from '../src/game/stages';
import {
  MAX_PLAYERS,
  PLACE_EMOJI,
  PLAYER_CHARACTERS,
  PLAYER_COLORS,
  PLAYER_KEY_CODES,
  PLAYER_KEY_LABELS,
  PLAYER_LABELS,
  canPlayVersus,
  rankPlayers,
} from '../src/game/versus';

describe('プレイヤー定義', () => {
  it('ラベル・キー・キャラ・色・順位絵文字が最大人数分ある', () => {
    expect(PLAYER_LABELS).toHaveLength(MAX_PLAYERS);
    expect(PLAYER_KEY_CODES).toHaveLength(MAX_PLAYERS);
    expect(PLAYER_KEY_LABELS).toHaveLength(MAX_PLAYERS);
    expect(PLAYER_CHARACTERS).toHaveLength(MAX_PLAYERS);
    expect(PLAYER_COLORS).toHaveLength(MAX_PLAYERS);
    expect(PLACE_EMOJI).toHaveLength(MAX_PLAYERS);
  });

  it('担当キーが重複しない', () => {
    expect(new Set(PLAYER_KEY_CODES).size).toBe(MAX_PLAYERS);
  });

  it('キャラクターが重複しない', () => {
    expect(new Set(PLAYER_CHARACTERS).size).toBe(MAX_PLAYERS);
  });
});

describe('canPlayVersus', () => {
  it('flow ステージは対戦できる', () => {
    const flowStages = STAGES.filter((s) => (s.gameSystem ?? 'flow') === 'flow');
    expect(flowStages.length).toBeGreaterThan(0);
    for (const stage of flowStages) {
      expect(canPlayVersus(stage)).toBe(true);
    }
  });

  it('コール&レスポンス型は対戦できない(1P専用)', () => {
    const echoStages = STAGES.filter((s) => s.gameSystem === 'echo');
    expect(echoStages.length).toBeGreaterThan(0);
    for (const stage of echoStages) {
      expect(canPlayVersus(stage)).toBe(false);
    }
  });

  it('ギミック付き flow ステージ(逆走・とつぜん)も対戦できる', () => {
    for (const stage of STAGES.filter((s) => s.reverse || s.suddenNotes)) {
      expect(canPlayVersus(stage)).toBe(true);
    }
  });
});

describe('rankPlayers', () => {
  it('スコア順に0始まりの順位を付ける', () => {
    expect(rankPlayers([300, 100, 200])).toEqual([0, 2, 1]);
  });

  it('同点は同順位で次の順位が飛ぶ(standard competition ranking)', () => {
    expect(rankPlayers([100, 100, 50])).toEqual([0, 0, 2]);
    expect(rankPlayers([300, 100, 200, 100])).toEqual([0, 2, 1, 2]);
  });

  it('全員同点なら全員1位', () => {
    expect(rankPlayers([500, 500, 500, 500])).toEqual([0, 0, 0, 0]);
  });

  it('1人なら1位', () => {
    expect(rankPlayers([0])).toEqual([0]);
  });

  it('空配列なら空', () => {
    expect(rankPlayers([])).toEqual([]);
  });
});
