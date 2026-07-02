import { COUNT_IN_BEATS, buildBeats, createChart, type Chart } from './chart';
import type { StageMusic } from './music';

/** ステージの見た目テーマ(CSSカスタムプロパティに反映) */
export interface StageTheme {
  bgTop: string;
  bgBottom: string;
  ink: string;
  accent: string;
  lane: string;
}

export interface StageDef {
  id: string;
  title: string;
  subtitle: string;
  /** ヒットゾーンにいるキャラクター */
  character: string;
  noteEmoji: string;
  starEmoji: string;
  bpm: number;
  /** 小節ごとのノーツ拍位置(0.5 = 8分裏) */
  patterns: readonly (readonly number[])[];
  /** 小節ごとのスターノーツ拍位置(patterns の部分集合であること) */
  stars: readonly (readonly number[])[];
  /** 小節ごとのおじゃまノーツ💣拍位置(patterns とは重ならないこと) */
  bombs: readonly (readonly number[])[];
  /** 画面下で応援してくれる観客たち */
  audience: readonly string[];
  /** true ならノーツがヒットゾーン手前で見えなくなる(暗記ステージ) */
  hideNotes?: boolean;
  music: StageMusic;
  theme: StageTheme;
}

const NO_BOMBS_12 = Array.from({ length: 12 }, () => [] as number[]);

/** ステージ1: ゆったり4分打ち中心の入門ステージ */
const forestConcert: StageDef = {
  id: 'forest',
  title: 'もりのコンサート',
  subtitle: 'キツネのドラマーと ゆったりビート',
  character: '🦊',
  noteEmoji: '🎵',
  starEmoji: '⭐',
  bpm: 100,
  patterns: [
    [0, 2],
    [0, 2],
    [0, 2],
    [0],
    [0, 2],
    [0, 2],
    [0, 1, 2],
    [0],
    [0, 2],
    [0, 2, 3],
    [0, 1, 2, 3],
    [0],
  ],
  stars: [[], [], [], [], [], [], [], [0], [], [], [], [0]],
  bombs: NO_BOMBS_12,
  audience: ['🐿️', '🐦', '🦔'],
  music: {
    // C -> C -> F -> G
    bassRoots: [48, 48, 53, 55],
    // Cメジャーペンタトニック
    scale: [60, 62, 64, 67, 69, 72],
  },
  theme: {
    bgTop: '#d8f7a6',
    bgBottom: '#5fc46f',
    ink: '#2b4a1c',
    accent: '#ff7043',
    lane: '#f3ffe0',
  },
};

/** ステージ2: 8分裏とおじゃまノーツが混ざる中級ステージ */
const moonMochi: StageDef = {
  id: 'moon',
  title: 'つきよのもちつき',
  subtitle: 'ウサギと ぺったん うらリズム',
  character: '🐰',
  noteEmoji: '🍡',
  starEmoji: '🌟',
  bpm: 126,
  patterns: [
    [0, 2],
    [0, 2],
    [0, 1.5, 2],
    [0, 1.5, 2],
    [0, 2, 3],
    [0, 2, 3],
    [0, 1.5, 3],
    [0],
    [0, 1, 2, 3],
    [0, 1.5, 2, 3.5],
    [0, 1.5, 2],
    [0, 1.5, 2, 3],
    [2, 3],
    [0],
  ],
  stars: [[], [], [], [], [], [], [], [0], [], [3.5], [], [], [], [0]],
  bombs: [[], [], [], [], [], [], [], [2], [], [], [], [], [0], []],
  audience: ['🐭', '🐹', '🐢'],
  music: {
    // Am -> Am -> Dm -> E
    bassRoots: [45, 45, 50, 52],
    // Aマイナーペンタトニック
    scale: [57, 60, 62, 64, 67, 69],
  },
  theme: {
    bgTop: '#2e3a67',
    bgBottom: '#141b3d',
    ink: '#f4f0ff',
    accent: '#ffd166',
    lane: '#4a5588',
  },
};

/** ステージ3: 高速・連打ありの上級ステージ */
const festivalDrums: StageDef = {
  id: 'festival',
  title: 'おまつりドラム',
  subtitle: 'タヌキばやしで れんだ に ちょうせん!',
  character: '🦝',
  noteEmoji: '🏮',
  starEmoji: '🎆',
  bpm: 140,
  patterns: [
    [0, 1, 2, 3],
    [0, 1, 2, 3],
    [0, 1.5, 2, 3.5],
    [0, 1.5, 2, 3.5],
    [0, 0.5, 1, 2],
    [0, 0.5, 1, 2],
    [0, 1, 1.5, 2, 2.5, 3],
    [0],
    [0, 2],
    [0, 1.5, 3],
    [0, 0.5, 1, 1.5, 2],
    [0, 2, 3.5],
    [0, 1, 2, 3],
    [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    [0, 1, 2, 3],
    [0],
  ],
  stars: [[], [], [], [], [], [], [], [0], [], [], [], [3.5], [], [], [], [0]],
  bombs: [[], [], [], [], [], [], [], [2], [], [2.5], [], [], [], [], [], []],
  audience: ['🐸', '🐵', '🐶'],
  music: {
    // Dm -> Dm -> Gm -> A
    bassRoots: [38, 38, 43, 45],
    // Dマイナーペンタトニック
    scale: [50, 53, 55, 57, 60, 62],
  },
  theme: {
    bgTop: '#ff9e5e',
    bgBottom: '#c9366b',
    ink: '#4a1424',
    accent: '#ffe066',
    lane: '#ffe9d6',
  },
};

/** ステージ4: ノーツが途中で消える暗記ステージ */
const phantomOrchestra: StageDef = {
  id: 'phantom',
  title: 'まぼろしのオーケストラ',
  subtitle: 'ノーツが きえる!? リズムを おぼえて たたけ',
  character: '🦉',
  noteEmoji: '🎶',
  starEmoji: '🌠',
  bpm: 116,
  hideNotes: true,
  patterns: [
    [0, 2],
    [0, 2],
    [0, 1, 2],
    [0, 1, 2],
    [0, 1.5, 2],
    [0, 1.5, 2],
    [0],
    [0, 1, 2, 3],
    [0, 1, 2, 3],
    [0, 1.5, 2, 3],
    [0, 1.5, 2, 3],
    [2, 3],
    [0, 0.5, 1, 2],
    [0],
  ],
  stars: [[], [], [], [], [], [], [0], [], [], [], [3], [], [], [0]],
  bombs: [[], [3], [], [], [], [], [3], [], [], [], [], [0], [], []],
  audience: ['🦇', '🐺', '🕷️'],
  music: {
    // Em -> Em -> C -> D
    bassRoots: [40, 40, 48, 50],
    // Eマイナーペンタトニック
    scale: [52, 55, 57, 59, 62, 64],
  },
  theme: {
    bgTop: '#4a2c6b',
    bgBottom: '#1e1433',
    ink: '#f3ecff',
    accent: '#e879f9',
    lane: '#6b5a99',
  },
};

export const STAGES: readonly StageDef[] = [
  forestConcert,
  moonMochi,
  festivalDrums,
  phantomOrchestra,
];

export const STAGE_IDS: readonly string[] = STAGES.map((s) => s.id);

/** ステージ定義から譜面を生成する(カウントイン4拍のあと開始) */
export function createStageChart(stage: StageDef): Chart {
  return createChart(
    stage.bpm,
    buildBeats(stage.patterns, COUNT_IN_BEATS),
    buildBeats(stage.stars, COUNT_IN_BEATS),
    buildBeats(stage.bombs, COUNT_IN_BEATS),
  );
}
