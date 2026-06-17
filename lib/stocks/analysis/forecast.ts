import { CategoryScore, HorizonForecast, StockForecast, OHLCV } from '../types';
import { clamp, scoreToDirection } from '../utils';
import { runTechnicalAnalysis, calcPriceRange } from './technical';
import { runThemeAnalysis } from './themes';
import { runEventAnalysis } from './events';
import { runBacktest } from './backtest';
import { parseFundamental, runFundamentalAnalysis, QuoteSummaryRaw } from './fundamental';
import { runMacroAnalysis, toMacroDisplay, MacroRaw } from './macro';
import { runNewsAnalysis, NewsItem } from './news';

const WEIGHTS = {
  short:  { technical: 0.45, theme: 0.18, macro: 0.12, event: 0.15, fundamental: 0.05, news: 0.05 },
  medium: { technical: 0.30, theme: 0.25, macro: 0.15, event: 0.12, fundamental: 0.12, news: 0.06 },
  long:   { technical: 0.12, theme: 0.30, macro: 0.22, event: 0.08, fundamental: 0.20, news: 0.08 },
};

function combineScores(
  cats: StockForecast['categoryScores'],
  horizon: 'short' | 'medium' | 'long',
): { score: number; confidence: number; warnings: string[] } {
  const w = WEIGHTS[horizon];
  const entries = [
    { key: 'technical'    as const, cat: cats.technical },
    { key: 'theme'        as const, cat: cats.theme },
    { key: 'macro'        as const, cat: cats.macro },
    { key: 'event'        as const, cat: cats.event },
    { key: 'fundamental'  as const, cat: cats.fundamental },
    { key: 'news'         as const, cat: cats.news },
  ];

  let weightedScore = 0;
  let weightedConf = 0;
  const warnings: string[] = [];

  for (const { key, cat } of entries) {
    weightedScore += cat.score * w[key];
    weightedConf += cat.confidence * w[key];
    if (cat.warnings.length) warnings.push(...cat.warnings.slice(0, 1));
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
  horizonDays: number,
): HorizonForecast {
  const { score, confidence, warnings } = combineScores(cats, horizon);
  const direction = scoreToDirection(score);
  const expectedRange = calcPriceRange(data, horizonDays);

  const allReasons = [
    ...cats.technical.reasons,
    ...cats.theme.reasons,
    ...cats.event.reasons,
    ...cats.macro.reasons,
    ...cats.fundamental.reasons,
    ...cats.news.reasons,
  ];
  const positive = allReasons.filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
  const negative = allReasons.filter(r => r.score < 0).sort((a, b) => a.score - b.score).slice(0, 6);

  return { horizon, score, direction, confidence, expectedRange, positiveFactors: positive, negativeFactors: negative, warnings };
}

function calcDataQuality(cats: StockForecast['categoryScores'], data: OHLCV[]) {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (data.length < 20) missingFields.push('価格データ不足');
  if (cats.fundamental.confidence < 0.3) missingFields.push('ファンダメンタルデータ取得失敗');
  if (cats.macro.confidence < 0.5) warnings.push('マクロデータの一部が取得できませんでした');
  if (cats.news.confidence < 0.3) warnings.push('ニュースデータが少ない');

  const score = clamp(100 - missingFields.length * 12 - warnings.length * 4, 0, 100);
  return { score, missingFields, warnings };
}

const STOCK_NAMES: Record<string, string> = {
  MU: 'マイクロン・テクノロジー', MRVL: 'マーベル・テクノロジー', NBIS: 'ネビウス・グループ',
  AMAT: 'アプライド・マテリアルズ', LITE: 'ルメンタム・ホールディングス', SNDK: 'サンディスク',
  '285A.T': 'キオクシア', '5016.T': 'JX金属', '5803.T': 'フジクラ', '5801.T': '古河電工', '5802.T': '住友電工',
};

function toStockId(symbol: string): string {
  return symbol.replace('.T', '').replace(/^285A$/, '285A');
}

const JP_STOCKS = new Set(['285A.T', '5016.T', '5803.T', '5801.T', '5802.T']);

export function buildForecast(
  symbol: string,
  data: OHLCV[],
  quoteSummary: QuoteSummaryRaw | null,
  macroRaw: MacroRaw,
  newsItems: NewsItem[],
): StockForecast {
  const stockId = toStockId(symbol);
  const isJP = JP_STOCKS.has(symbol);

  const technical = runTechnicalAnalysis(data);
  const theme = runThemeAnalysis(stockId);
  const event = runEventAnalysis(stockId);
  const macro = runMacroAnalysis(macroRaw, isJP);
  const fundamentalDisplay = quoteSummary ? parseFundamental(quoteSummary) : {};
  const fundamental = runFundamentalAnalysis(stockId, fundamentalDisplay);
  const news = runNewsAnalysis(newsItems);
  const backtest = runBacktest(data);

  const categoryScores = { technical, theme, macro, event, fundamental, news };
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
    fundamentalDisplay: Object.keys(fundamentalDisplay).length ? fundamentalDisplay : undefined,
    macroDisplay: toMacroDisplay(macroRaw),
    newsItems,
  };
}
