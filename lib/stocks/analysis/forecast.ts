import { CategoryScore, HorizonForecast, StockForecast, OHLCV } from '../types';
import { clamp, safe, scoreToDirection } from '../utils';
import { runTechnicalAnalysis, calcPriceRange } from './technical';
import { runThemeAnalysis } from './themes';
import { runEventAnalysis } from './events';
import { runBacktest } from './backtest';

const MACRO_SCORE: CategoryScore = {
  score: 72,
  confidence: 0.5,
  reasons: [
    { name: 'FRB利下げ期待', score: 8, reason: '2026年後半の利下げ観測がグロース株をサポート', source: 'マクロ環境（手動設定）' },
    { name: '米中関係', score: -5, reason: '輸出規制リスクは継続。半導体関連は要注意', source: 'マクロ環境（手動設定）' },
    { name: 'AI投資サイクル', score: 10, reason: 'ハイパースケーラーの設備投資拡大が続く', source: 'マクロ環境（手動設定）' },
    { name: '円安動向', score: 5, reason: '円安継続で日本株の海外売上に追い風', source: 'マクロ環境（手動設定）' },
  ],
  warnings: ['マクロスコアは手動設定値です（Phase 2で自動取得予定）'],
};

const FUNDAMENTAL_PLACEHOLDER: CategoryScore = {
  score: 50,
  confidence: 0.1,
  reasons: [],
  warnings: ['ファンダメンタル分析はPhase 2で実装予定'],
};

const WEIGHTS = {
  short:  { technical: 0.50, theme: 0.20, macro: 0.10, event: 0.20, fundamental: 0.00 },
  medium: { technical: 0.35, theme: 0.30, macro: 0.15, event: 0.15, fundamental: 0.05 },
  long:   { technical: 0.15, theme: 0.35, macro: 0.25, event: 0.10, fundamental: 0.15 },
};

function combineScores(
  cats: StockForecast['categoryScores'],
  horizon: 'short' | 'medium' | 'long'
): { score: number; confidence: number; warnings: string[] } {
  const w = WEIGHTS[horizon];
  const entries = [
    { key: 'technical', cat: cats.technical },
    { key: 'theme',     cat: cats.theme },
    { key: 'macro',     cat: cats.macro },
    { key: 'event',     cat: cats.event },
    { key: 'fundamental', cat: cats.fundamental },
  ] as const;

  let weightedScore = 0;
  let weightedConf = 0;
  const warnings: string[] = [];

  for (const { key, cat } of entries) {
    const wt = w[key];
    weightedScore += cat.score * wt;
    weightedConf += cat.confidence * wt;
    if (cat.warnings.length && key !== 'fundamental') {
      warnings.push(...cat.warnings.slice(0, 1));
    }
  }

  return {
    score: clamp(Math.round(weightedScore), 0, 100),
    confidence: clamp(weightedConf, 0, 1),
    warnings: [...new Set(warnings)],
  };
}

function buildHorizon(
  horizon: 'short' | 'medium' | 'long',
  cats: StockForecast['categoryScores'],
  data: OHLCV[],
  horizonDays: number
): HorizonForecast {
  const { score, confidence, warnings } = combineScores(cats, horizon);
  const direction = scoreToDirection(score);
  const expectedRange = calcPriceRange(data, horizonDays);

  const allReasons = [
    ...cats.technical.reasons,
    ...cats.theme.reasons,
    ...cats.event.reasons,
    ...cats.macro.reasons,
  ];
  const positive = allReasons.filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  const negative = allReasons.filter(r => r.score < 0).sort((a, b) => a.score - b.score).slice(0, 5);

  return { horizon, score, direction, confidence, expectedRange, positiveFactors: positive, negativeFactors: negative, warnings };
}

function calcDataQuality(cats: StockForecast['categoryScores'], data: OHLCV[]) {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (data.length < 20) missingFields.push('価格データ不足');
  if (cats.fundamental.confidence < 0.3) missingFields.push('ファンダメンタルデータ（Phase 2実装予定）');
  if (cats.macro.confidence < 0.6) warnings.push('マクロスコアは手動設定値');

  const score = clamp(
    100 - missingFields.length * 15 - warnings.length * 5,
    0, 100
  );
  return { score, missingFields, warnings };
}

const STOCK_NAMES: Record<string, string> = {
  MU: 'マイクロン・テクノロジー', MRVL: 'マーベル・テクノロジー', NBIS: 'ネビウス・グループ',
  AMAT: 'アプライド・マテリアルズ', LITE: 'ルメンタム・ホールディングス', SNDK: 'サンディスク',
  '285A.T': 'キオクシア', '5016.T': 'JX金属', '5803.T': 'フジクラ', '5801.T': '古河電工', '5802.T': '住友電工',
};

function toStockId(symbol: string): string {
  return symbol.replace('.T', '').replace('285A.T', '285A');
}

export function buildForecast(symbol: string, data: OHLCV[]): StockForecast {
  const stockId = toStockId(symbol);
  const technical = runTechnicalAnalysis(data);
  const theme = runThemeAnalysis(stockId);
  const event = runEventAnalysis(stockId);
  const macro = MACRO_SCORE;
  const fundamental = FUNDAMENTAL_PLACEHOLDER;
  const backtest = runBacktest(data);

  const categoryScores = { technical, theme, macro, event, fundamental };
  const dataQuality = calcDataQuality(categoryScores, data);

  return {
    symbol,
    name: STOCK_NAMES[symbol] ?? symbol,
    updatedAt: new Date().toISOString(),
    dataQuality,
    categoryScores,
    forecast: {
      shortTerm:  buildHorizon('short',  categoryScores, data, 14),
      mediumTerm: buildHorizon('medium', categoryScores, data, 45),
      longTerm:   buildHorizon('long',   categoryScores, data, 180),
    },
    backtest,
  };
}
