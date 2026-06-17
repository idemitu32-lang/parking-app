import { CategoryScore } from '../types';
import { clamp } from '../utils';

// Phase 1: 手動設定。Phase 2でニュース・指数から自動更新予定
const THEME_MARKET: Record<string, { score: number; reason: string }> = {
  'AI半導体':      { score: 90, reason: 'AI推論・学習サーバー投資拡大。NVIDIA主導の需要は2026年も継続' },
  'HBM':           { score: 85, reason: 'HBM3E/HBM4供給タイト。AIサーバー1台あたりのHBM搭載量増加' },
  'DRAM':          { score: 68, reason: 'DDR5移行継続。AI向け需要は強いがPC/スマホ回復は緩慢' },
  'NAND':          { score: 60, reason: 'エンタープライズSSD需要回復中。価格はまだ回復途上' },
  'データセンター': { score: 88, reason: 'ハイパースケーラーの設備投資は2026年も加速' },
  '光ファイバー':   { score: 82, reason: 'AI DC内光配線需要急増。800G/1.6T移行本格化' },
  '電線':           { score: 78, reason: '電力インフラ更新＋EV充電インフラで需要拡大' },
  '銅':             { score: 72, reason: '電動化・電力インフラ需要に支えられ高水準' },
  '半導体製造装置': { score: 80, reason: 'GAA移行でエッチング・成膜装置需要急増' },
  'カスタムASIC':   { score: 84, reason: 'Amazon/GoogleがXPUを大量発注。市場急拡大' },
  'AIクラウド':     { score: 86, reason: 'AI推論クラウド需要急拡大。EU・中東でも台頭' },
  'EV充電':         { score: 62, reason: 'EV普及は想定より遅れ気味だが中長期需要は変わらず' },
  '電力インフラ':   { score: 80, reason: 'AI消費電力増大で電力設備増強が急務' },
  '防衛':           { score: 72, reason: '欧州・中東緊張継続で防衛予算増。日本も防衛費倍増進行中' },
  '原子力':         { score: 66, reason: 'AI電力需要を背景にSMRへの関心高まる' },
};

const STOCK_THEMES: Record<string, string[]> = {
  MU:   ['AI半導体', 'HBM', 'DRAM', 'NAND', 'データセンター'],
  MRVL: ['AI半導体', 'カスタムASIC', '光ファイバー', 'データセンター'],
  NBIS: ['AIクラウド', 'データセンター', 'AI半導体'],
  AMAT: ['半導体製造装置', 'AI半導体', 'データセンター'],
  LITE: ['光ファイバー', 'データセンター', 'AI半導体'],
  SNDK: ['NAND', 'データセンター', 'AI半導体'],
  '285A': ['NAND', 'HBM', 'データセンター', 'AI半導体'],
  '5016': ['銅', '電線', 'EV充電', 'データセンター'],
  '5803': ['光ファイバー', '電線', 'データセンター', '電力インフラ'],
  '5801': ['電線', '電力インフラ', 'EV充電', '銅'],
  '5802': ['電線', 'EV充電', '電力インフラ', 'データセンター'],
};

export function runThemeAnalysis(stockId: string): CategoryScore {
  const themes = STOCK_THEMES[stockId] ?? [];
  if (!themes.length) {
    return { score: 50, confidence: 0.3, reasons: [], warnings: ['テーマ分類が未設定'] };
  }

  let weightedScore = 0;
  let totalWeight = 0;
  const reasons = themes.map((theme, i) => {
    const t = THEME_MARKET[theme] ?? { score: 50, reason: '詳細データなし' };
    const weight = 1 / (i + 1);
    weightedScore += t.score * weight;
    totalWeight += weight;
    return {
      name: theme,
      score: t.score >= 80 ? 10 : t.score >= 65 ? 5 : t.score >= 50 ? 2 : -3,
      reason: t.reason,
      source: '市場環境判断（手動設定・2026-06-17）',
    };
  });

  const score = totalWeight > 0 ? clamp(Math.round(weightedScore / totalWeight), 0, 100) : 50;
  return {
    score,
    confidence: 0.6,
    reasons,
    warnings: ['テーマスコアは手動設定値です（Phase 2でニュース連動化予定）'],
  };
}

export function getThemes(stockId: string): string[] {
  return STOCK_THEMES[stockId] ?? [];
}
