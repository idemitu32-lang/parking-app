import { OHLCV, CategoryScore, ScoreReason, ForecastRange } from '../types';
import { safe, clamp, pct, median } from '../utils';

// ── Core indicators ──────────────────────────────────────────────────────────

function sma(data: OHLCV[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const sum = data.slice(i - period + 1, i + 1).reduce((a, d) => a + safe(d.close), 0);
    return sum / period;
  });
}

function ema(closes: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let e = closes[0] ?? 0;
  for (const c of closes) { e = c * k + e * (1 - k); out.push(e); }
  return out;
}

function calcRSI(data: OHLCV[], period = 14): (number | null)[] {
  const gains: number[] = [], losses: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const d = safe(data[i].close) - safe(data[i - 1].close);
    gains.push(d > 0 ? d : 0);
    losses.push(d < 0 ? -d : 0);
  }
  const result: (number | null)[] = [null];
  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    const ag = gains.slice(i - period + 1, i + 1).reduce((a, v) => a + v, 0) / period;
    const al = losses.slice(i - period + 1, i + 1).reduce((a, v) => a + v, 0) / period;
    result.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  }
  return result;
}

function calcMACD(data: OHLCV[]) {
  const closes = data.map(d => safe(d.close));
  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  const line = e12.map((v, i) => v - e26[i]);
  const sig = ema(line, 9);
  return { line, sig, hist: line.map((v, i) => v - sig[i]) };
}

function calcATR(data: OHLCV[], period = 14): (number | null)[] {
  const tr = data.map((d, i) => {
    if (i === 0) return safe(d.high) - safe(d.low);
    const pc = safe(data[i - 1].close);
    return Math.max(safe(d.high) - safe(d.low), Math.abs(safe(d.high) - pc), Math.abs(safe(d.low) - pc));
  });
  return tr.map((_, i) => {
    if (i < period - 1) return null;
    return tr.slice(i - period + 1, i + 1).reduce((a, v) => a + v, 0) / period;
  });
}

function calcBB(data: OHLCV[], period = 20, mult = 2) {
  const s = sma(data, period);
  return data.map((_, i) => {
    const mid = s[i];
    if (mid == null) return { upper: null, mid: null, lower: null };
    const sl = data.slice(Math.max(0, i - period + 1), i + 1);
    const sd = Math.sqrt(sl.reduce((a, d) => a + (safe(d.close) - mid) ** 2, 0) / sl.length);
    return { upper: mid + mult * sd, mid, lower: mid - mult * sd };
  });
}

function dailyVol(data: OHLCV[], lookback = 60): number {
  const n = data.length;
  const rets: number[] = [];
  for (let i = Math.max(1, n - lookback); i < n; i++) {
    const r = Math.log(safe(data[i].close, 1) / safe(data[i - 1].close, 1));
    if (isFinite(r) && r !== 0) rets.push(r);
  }
  if (!rets.length) return 0.02;
  return Math.sqrt(rets.reduce((a, v) => a + v ** 2, 0) / rets.length);
}

// ── Main analysis ─────────────────────────────────────────────────────────────

export function runTechnicalAnalysis(data: OHLCV[]): CategoryScore {
  const warnings: string[] = [];
  const reasons: ScoreReason[] = [];

  if (data.length < 20) {
    return { score: 50, confidence: 0.15, reasons: [], warnings: ['データ不足：最低20日分が必要'] };
  }

  const n = data.length;
  const last = data[n - 1];
  const lc = safe(last.close);

  if (lc <= 0) {
    return { score: 50, confidence: 0.1, reasons: [], warnings: ['株価データ異常 (0以下)'] };
  }

  const push = (name: string, score: number, reason: string, source = 'テクニカル分析') => {
    reasons.push({ name, score, reason, source });
    return score;
  };

  let S = 50;

  // ── SMA20 deviation ────────────────────────────────────────────────
  const s20arr = sma(data, 20);
  const s50arr = sma(data, Math.min(50, n));
  const s60arr = sma(data, Math.min(60, n));
  const s200arr = sma(data, Math.min(200, n));
  const s20 = s20arr[n - 1], s50 = s50arr[n - 1];
  const s60 = s60arr[n - 1], s200 = s200arr[n - 1];

  if (s20) {
    const dev = (lc / s20 - 1) * 100;
    if (dev > 8)       S += push('20日線過熱乖離', -6, `終値が20日線から+${dev.toFixed(1)}%（短期過熱）`);
    else if (dev > 2)  S += push('20日線上位', 8,  `終値が20日線を+${dev.toFixed(1)}%上回る`);
    else if (dev > -2) S += push('20日線付近', 2,  `20日線近辺で推移`);
    else if (dev > -8) S += push('20日線下位', -5, `終値が20日線を${dev.toFixed(1)}%下回る`);
    else               S += push('20日線乖離売られ過ぎ', 5, `20日線から${dev.toFixed(1)}%（反発余地）`);
  }

  // ── SMA60/200 trend ────────────────────────────────────────────────
  if (s60) {
    const dev = (lc / s60 - 1) * 100;
    if (dev > 0) S += push('60日線上位', 6, `中期上昇トレンド（60日線+${dev.toFixed(1)}%）`);
    else         S += push('60日線下位', -5, `中期下降トレンド（60日線${dev.toFixed(1)}%）`);
  }
  if (s200) {
    const dev = (lc / s200 - 1) * 100;
    if (dev > 0) S += push('200日線上位', 10, `長期上昇トレンド（200日線+${dev.toFixed(1)}%）`);
    else         S += push('200日線下位', -9, `長期下降トレンド（200日線${dev.toFixed(1)}%）`);
  } else {
    warnings.push('200日移動平均：データ不足（200日未満）');
  }

  // ── Golden/Dead cross ──────────────────────────────────────────────
  if (s20 && s50) {
    const ps20 = s20arr[n - 2], ps50 = s50arr[n - 2];
    if (s20 > s50 && ps20 != null && ps50 != null && ps20 <= ps50)
      S += push('ゴールデンクロス', 14, '20日線が50日線を上抜け（直近）');
    else if (s20 < s50 && ps20 != null && ps50 != null && ps20 >= ps50)
      S += push('デッドクロス', -14, '20日線が50日線を下抜け（直近）');
    else if (s20 > s50)
      S += push('20日>50日配置', 5, '短期線が中期線を上回る強気配置');
    else
      S += push('20日<50日配置', -5, '短期線が中期線を下回る弱気配置');
  }

  // ── RSI ────────────────────────────────────────────────────────────
  const rsiArr = calcRSI(data);
  const lastRSI = rsiArr[n - 1];
  if (lastRSI != null) {
    if (lastRSI > 80)      S += push('RSI強過熱', -12, `RSI ${lastRSI.toFixed(0)}（強い買われ過ぎ）`);
    else if (lastRSI > 70) S += push('RSI買われ過ぎ', -7, `RSI ${lastRSI.toFixed(0)}（買われ過ぎ圏）`);
    else if (lastRSI > 55) S += push('RSI強気圏', 6,   `RSI ${lastRSI.toFixed(0)}（強気圏）`);
    else if (lastRSI < 20) S += push('RSI強売られ過ぎ', 12, `RSI ${lastRSI.toFixed(0)}（強い売られ過ぎ・反発期待）`);
    else if (lastRSI < 30) S += push('RSI売られ過ぎ', 7,  `RSI ${lastRSI.toFixed(0)}（売られ過ぎ・反発余地）`);
    else if (lastRSI < 45) S += push('RSI弱気圏', -4,  `RSI ${lastRSI.toFixed(0)}（弱気圏）`);
  } else {
    warnings.push('RSI：計算不能（データ不足）');
  }

  // ── MACD ───────────────────────────────────────────────────────────
  const { line: ml, sig: ms } = calcMACD(data);
  const lml = ml[n - 1], lms = ms[n - 1];
  const pml = ml[n - 2], pms = ms[n - 2];
  if (isFinite(lml) && isFinite(lms)) {
    if (pml <= pms && lml > lms)        S += push('MACDゴールデンクロス', 12, 'MACDがシグナルを上抜け');
    else if (pml >= pms && lml < lms)   S += push('MACDデッドクロス', -12, 'MACDがシグナルを下抜け');
    else if (lml > lms)                 S += push('MACD上昇モメンタム', 5, 'MACDがシグナル線上位');
    else                                S += push('MACD下落モメンタム', -5, 'MACDがシグナル線下位');
  }

  // ── Bollinger Band ──────────────────────────────────────────────────
  const bbArr = calcBB(data);
  const bb = bbArr[n - 1];
  if (bb.upper && bb.lower && bb.mid) {
    const range = bb.upper - bb.lower;
    const pos = range > 0 ? (lc - bb.lower) / range : 0.5;
    if (pos > 0.95)      S += push('BB上限突破', -7,  'ボリンジャーバンド上限を超過（短期過熱）');
    else if (pos > 0.75) S += push('BB上位', 4,       'ボリンジャーバンド上半分（強気）');
    else if (pos < 0.05) S += push('BB下限突破', 7,   'ボリンジャーバンド下限を割込（売られ過ぎ）');
    else if (pos < 0.25) S += push('BB下位', -4,      'ボリンジャーバンド下半分（弱気）');
  }

  // ── Returns ──────────────────────────────────────────────────────────
  const ret = (days: number): number | null => {
    const idx = n - 1 - days;
    if (idx < 0) return null;
    const base = safe(data[idx].close);
    return base > 0 ? (lc / base - 1) * 100 : null;
  };
  const r5 = ret(5), r20 = ret(20), r60 = ret(60), r120 = ret(120);

  if (r5 != null) {
    if (r5 > 12)       S += push('5日急騰', -5, `5日間+${r5.toFixed(1)}%（短期過熱・利確注意）`);
    else if (r5 > 3)   S += push('5日上昇', 4,  `5日間+${r5.toFixed(1)}%（好調モメンタム）`);
    else if (r5 < -12) S += push('5日急落', 5,  `5日間${r5.toFixed(1)}%（売られ過ぎ・反発余地）`);
    else if (r5 < -3)  S += push('5日下落', -3, `5日間${r5.toFixed(1)}%（弱いモメンタム）`);
  }
  if (r20 != null) {
    if (r20 > 20)      S += push('20日大幅上昇', -4, `20日間+${r20.toFixed(1)}%（中期過熱）`);
    else if (r20 > 5)  S += push('20日上昇', 5,  `20日間+${r20.toFixed(1)}%（良好なモメンタム）`);
    else if (r20 < -20) S += push('20日大幅下落', 4, `20日間${r20.toFixed(1)}%（反発余地）`);
    else if (r20 < -5)  S += push('20日下落', -4, `20日間${r20.toFixed(1)}%（弱い）`);
  }
  if (r60 != null) {
    if (r60 > 30)      S += push('60日急騰', -5, `60日間+${r60.toFixed(1)}%（中期過熱）`);
    else if (r60 > 10) S += push('60日上昇', 5,  `60日間+${r60.toFixed(1)}%（中期上昇トレンド）`);
    else if (r60 < -20) S += push('60日下落', 4, `60日間${r60.toFixed(1)}%（反発余地あり）`);
  }

  // ── Volume ──────────────────────────────────────────────────────────
  const avgVol20 = data.slice(Math.max(0, n - 21), n - 1)
    .map(d => safe(d.volume)).filter(v => v > 0)
    .reduce((a, v, _, arr) => a + v / arr.length, 0);
  const lastVol = safe(last.volume);
  if (avgVol20 > 0 && lastVol > 0) {
    const ratio = lastVol / avgVol20;
    if (ratio > 3)        S += push('出来高急増', r5 != null && r5 > 0 ? 8 : -7, `出来高が20日平均の${ratio.toFixed(1)}倍`);
    else if (ratio > 1.5) S += push('出来高増加', 5, `出来高が20日平均の${ratio.toFixed(1)}倍（関心増加）`);
    else if (ratio < 0.5) S += push('出来高低迷', -3, `出来高が20日平均の${ratio.toFixed(1)}倍（関心低下）`);
  } else {
    warnings.push('出来高データ不足');
  }

  // ── 52-week range ──────────────────────────────────────────────────
  const slice52 = data.slice(Math.max(0, n - 252));
  const h52 = Math.max(...slice52.map(d => safe(d.high, 0)).filter(v => v > 0));
  const l52 = Math.min(...slice52.map(d => safe(d.low, Infinity)).filter(v => isFinite(v)));
  if (isFinite(h52) && h52 > 0) {
    const fromH = (lc / h52 - 1) * 100;
    if (fromH > -5)        S += push('52週高値付近', -5, `52週高値から${fromH.toFixed(1)}%（上値抵抗帯）`);
    else if (fromH > -20)  S += push('52週高値圏', 4,   `52週高値から${fromH.toFixed(1)}%（高位置）`);
    else if (fromH < -50)  S += push('52週安値圏', 7,   `52週高値から${fromH.toFixed(1)}%（バリュー圏）`);
  } else warnings.push('52週高値：データ不足');

  if (isFinite(l52) && l52 > 0) {
    const fromL = (lc / l52 - 1) * 100;
    if (fromL < 5)  S += push('52週安値付近', -6, `52週安値から+${fromL.toFixed(1)}%（下値サポート割れ注意）`);
    else if (fromL > 100) S += push('52週安値大幅上回り', 5, `52週安値から+${fromL.toFixed(1)}%（強い位置）`);
  } else warnings.push('52週安値：データ不足');

  // ── ATR / Volatility ───────────────────────────────────────────────
  const atrArr = calcATR(data);
  const lastATR = atrArr[n - 1];
  const dv = dailyVol(data) * Math.sqrt(252) * 100;
  if (dv > 80) warnings.push(`ボラティリティ極高（年率${dv.toFixed(0)}%）：予測信頼度が低下します`);
  else if (dv > 50) warnings.push(`ボラティリティ高（年率${dv.toFixed(0)}%）：レンジが広くなります`);

  const score = clamp(Math.round(S), 0, 100);
  const baseConf = warnings.length > 3 ? 0.35 : warnings.length > 1 ? 0.5 : 0.68;
  const volPenalty = dv > 80 ? 0.6 : dv > 50 ? 0.8 : 1.0;
  const confidence = Math.round(baseConf * volPenalty * 100) / 100;

  return { score, confidence, reasons, warnings };
}

// ── Price range prediction ────────────────────────────────────────────────────

export function calcPriceRange(data: OHLCV[], horizonDays: number): ForecastRange {
  if (data.length < 20) return { downside: -15, base: 0, upside: 15 };
  const n = data.length;
  const lc = safe(data[n - 1].close);
  if (lc <= 0) return { downside: -15, base: 0, upside: 15 };

  const dv = dailyVol(data);
  const periodVol = dv * Math.sqrt(horizonDays) * 100;

  // Trend component (20d momentum, decaying)
  const r20 = n > 21 ? (lc / safe(data[n - 21].close, lc) - 1) * 100 : 0;
  const trendDecay = Math.exp(-horizonDays / 60);
  const base = r20 * trendDecay * 0.3;

  const downside = parseFloat(Math.max(base - periodVol * 1.6, -60).toFixed(1));
  const upside   = parseFloat(Math.min(base + periodVol * 1.6,  80).toFixed(1));
  const baseVal  = parseFloat(Math.max(Math.min(base, 40), -40).toFixed(1));

  return { downside, base: baseVal, upside };
}

// ── Simplified scoring for backtest ───────────────────────────────────────────

export function quickTechScore(data: OHLCV[]): number {
  const n = data.length;
  if (n < 30) return 50;
  const lc = safe(data[n - 1].close);
  if (lc <= 0) return 50;

  let S = 50;
  const s20 = data.slice(n - 20).reduce((a, d) => a + safe(d.close), 0) / 20;
  S += lc > s20 ? 8 : -8;

  const rsi = calcRSI(data);
  const r = rsi[n - 1];
  if (r != null) {
    if (r > 70) S -= 7; else if (r > 55) S += 6;
    else if (r < 30) S += 7; else if (r < 45) S -= 4;
  }

  const { line, sig } = calcMACD(data);
  S += line[n - 1] > sig[n - 1] ? 5 : -5;

  return clamp(Math.round(S), 0, 100);
}
