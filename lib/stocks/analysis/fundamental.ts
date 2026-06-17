import { CategoryScore, FundamentalDisplay } from '../types';
import { clamp, safe } from '../utils';

// Raw shape from Yahoo Finance v10/finance/quoteSummary
export interface QuoteSummaryRaw {
  financialData?: {
    revenueGrowth?: { raw?: number };
    grossMargins?: { raw?: number };
    operatingMargins?: { raw?: number };
    returnOnEquity?: { raw?: number };
    currentRatio?: { raw?: number };
    debtToEquity?: { raw?: number };
    freeCashflow?: { raw?: number };
    totalRevenue?: { raw?: number };
    targetMeanPrice?: { raw?: number };
  };
  defaultKeyStatistics?: {
    forwardPE?: { raw?: number };
    trailingEps?: { raw?: number };
    pegRatio?: { raw?: number };
    priceToBook?: { raw?: number };
    enterpriseToEbitda?: { raw?: number };
    beta?: { raw?: number };
  };
  summaryDetail?: {
    dividendYield?: { raw?: number };
    marketCap?: { raw?: number };
    trailingPE?: { raw?: number };
    beta?: { raw?: number };
    currency?: string;
  };
}

function raw(v: { raw?: number } | undefined): number | undefined {
  if (v?.raw == null || !isFinite(v.raw) || isNaN(v.raw)) return undefined;
  return v.raw;
}

export function parseFundamental(data: QuoteSummaryRaw): FundamentalDisplay {
  const fd = data.financialData ?? {};
  const ks = data.defaultKeyStatistics ?? {};
  const sd = data.summaryDetail ?? {};
  return {
    marketCap: raw(sd.marketCap),
    currency: sd.currency,
    forwardPE: raw(ks.forwardPE),
    trailingPE: raw(sd.trailingPE),
    revenueGrowth: raw(fd.revenueGrowth),
    grossMargin: raw(fd.grossMargins),
    operatingMargin: raw(fd.operatingMargins),
    returnOnEquity: raw(fd.returnOnEquity),
    pegRatio: raw(ks.pegRatio),
    debtToEquity: raw(fd.debtToEquity),
    dividendYield: raw(sd.dividendYield),
    beta: raw(ks.beta) ?? raw(sd.beta),
    eps: raw(ks.trailingEps),
    priceToBook: raw(ks.priceToBook),
  };
}

// Sector-adjusted P/E benchmarks
const SECTOR_PE: Record<string, number> = {
  MU: 22, MRVL: 35, NBIS: 60, AMAT: 25, LITE: 28, SNDK: 20,
  '285A': 30, '5016': 18, '5803': 20, '5801': 16, '5802': 16,
};

export function runFundamentalAnalysis(
  stockId: string,
  display: FundamentalDisplay,
): CategoryScore {
  if (!display || Object.keys(display).length === 0) {
    return {
      score: 50,
      confidence: 0.1,
      reasons: [],
      warnings: ['ファンダメンタルデータ取得失敗。Yahoo Financeへの接続を確認してください'],
    };
  }

  const warnings: string[] = [];
  const reasons = [];
  let S = 50;
  let filledCount = 0;

  // Revenue growth
  if (display.revenueGrowth != null) {
    filledCount++;
    const g = display.revenueGrowth * 100;
    const adj = g > 30 ? 15 : g > 15 ? 10 : g > 5 ? 5 : g > 0 ? 1 : g > -10 ? -5 : -12;
    S += adj;
    reasons.push({ name: '売上成長率', score: adj, reason: `前年比 ${g.toFixed(1)}%`, source: 'Yahoo Finance' });
  } else warnings.push('売上成長率データなし');

  // Gross margin
  if (display.grossMargin != null) {
    filledCount++;
    const gm = display.grossMargin * 100;
    const adj = gm > 60 ? 10 : gm > 45 ? 6 : gm > 30 ? 2 : gm > 15 ? -2 : -8;
    S += adj;
    reasons.push({ name: '粗利益率', score: adj, reason: `${gm.toFixed(1)}%`, source: 'Yahoo Finance' });
  }

  // Operating margin
  if (display.operatingMargin != null) {
    filledCount++;
    const om = display.operatingMargin * 100;
    const adj = om > 25 ? 10 : om > 15 ? 5 : om > 5 ? 1 : om > 0 ? -3 : -10;
    S += adj;
    reasons.push({ name: '営業利益率', score: adj, reason: `${om.toFixed(1)}%`, source: 'Yahoo Finance' });
  }

  // Forward P/E vs sector benchmark
  if (display.forwardPE != null) {
    filledCount++;
    const benchmark = SECTOR_PE[stockId] ?? 25;
    const ratio = display.forwardPE / benchmark;
    const adj = ratio < 0.7 ? 10 : ratio < 0.9 ? 5 : ratio < 1.1 ? 0 : ratio < 1.4 ? -5 : -10;
    S += adj;
    reasons.push({
      name: '予想PER', score: adj,
      reason: `${display.forwardPE.toFixed(1)}倍（セクター平均${benchmark}倍比 ${ratio.toFixed(2)}x）`,
      source: 'Yahoo Finance',
    });
  }

  // ROE
  if (display.returnOnEquity != null) {
    filledCount++;
    const roe = display.returnOnEquity * 100;
    const adj = roe > 25 ? 10 : roe > 15 ? 5 : roe > 5 ? 1 : roe > 0 ? -2 : -10;
    S += adj;
    reasons.push({ name: 'ROE', score: adj, reason: `${roe.toFixed(1)}%`, source: 'Yahoo Finance' });
  }

  // PEG ratio
  if (display.pegRatio != null && display.pegRatio > 0) {
    filledCount++;
    const adj = display.pegRatio < 1 ? 10 : display.pegRatio < 1.5 ? 5 : display.pegRatio < 2.5 ? 0 : -8;
    S += adj;
    reasons.push({ name: 'PEGレシオ', score: adj, reason: `${display.pegRatio.toFixed(2)}（1未満が割安）`, source: 'Yahoo Finance' });
  }

  // Debt to equity
  if (display.debtToEquity != null) {
    filledCount++;
    const adj = display.debtToEquity < 50 ? 5 : display.debtToEquity < 150 ? 0 : display.debtToEquity < 300 ? -5 : -10;
    S += adj;
    if (display.debtToEquity > 200) {
      reasons.push({ name: '有利子負債', score: adj, reason: `D/E比率 ${display.debtToEquity.toFixed(0)}%（やや高い）`, source: 'Yahoo Finance' });
    }
  }

  // Beta (volatility risk)
  if (display.beta != null) {
    if (display.beta > 2.0) warnings.push(`ベータ値 ${display.beta.toFixed(2)}：市場の2倍以上の値動き`);
  }

  const confidence = clamp(filledCount / 6, 0.1, 0.9);

  return {
    score: clamp(Math.round(S), 0, 100),
    confidence,
    reasons,
    warnings,
  };
}
