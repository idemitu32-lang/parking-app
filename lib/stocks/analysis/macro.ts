import { CategoryScore, MacroDisplay } from '../types';
import { clamp, safe } from '../utils';

export interface MacroRaw {
  vix?: number;
  vixChange?: number;       // 1-day % change
  sox?: number;
  soxChange1m?: number;     // 1-month % change
  usdjpy?: number;
  usdjpyChange?: number;    // 1-month % change
  tnx?: number;             // 10Y yield %
  tnxChange?: number;
  sp500Change1m?: number;
}

export function runMacroAnalysis(macro: MacroRaw, isJP: boolean): CategoryScore {
  const warnings: string[] = [];
  const reasons = [];
  let S = 50;
  let filledCount = 0;

  // VIX
  if (macro.vix != null) {
    filledCount++;
    const vix = macro.vix;
    const adj = vix < 14 ? 15 : vix < 18 ? 8 : vix < 22 ? 2 : vix < 28 ? -8 : -18;
    S += adj;
    reasons.push({
      name: `VIX恐怖指数 (${vix.toFixed(1)})`,
      score: adj,
      reason: vix < 18 ? '市場は落ち着いており投資環境良好' : vix < 25 ? 'やや警戒感あり' : '市場の不安心理が高い。リスクオフ傾向',
      source: 'CBOE (Yahoo Finance)',
    });
    if (vix > 30) warnings.push(`⚡ VIX急上昇 (${vix.toFixed(1)})：市場の不安心理が高い`);
  } else warnings.push('VIXデータ取得失敗');

  // SOX (Semiconductor index)
  if (macro.soxChange1m != null) {
    filledCount++;
    const ch = macro.soxChange1m;
    const adj = ch > 10 ? 14 : ch > 5 ? 8 : ch > 0 ? 3 : ch > -5 ? -3 : ch > -12 ? -9 : -15;
    S += adj;
    reasons.push({
      name: `フィラデルフィア半導体指数(SOX) 1ヶ月 ${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%`,
      score: adj,
      reason: ch > 5 ? '半導体セクター全体が強く追い風' : ch > 0 ? '半導体セクターはやや上昇' : ch > -5 ? '半導体セクターは軟調' : '半導体セクター全体が弱い',
      source: 'Philadelphia Semiconductor Index',
    });
  }

  // S&P500
  if (macro.sp500Change1m != null) {
    filledCount++;
    const ch = macro.sp500Change1m;
    const adj = ch > 5 ? 8 : ch > 2 ? 4 : ch > 0 ? 1 : ch > -3 ? -3 : -8;
    S += adj;
    reasons.push({
      name: `S&P500 1ヶ月 ${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%`,
      score: adj,
      reason: ch > 0 ? '米国株全体が上昇基調でリスクオン環境' : '米国株全体が軟調。リスクオフ傾向',
      source: 'S&P500 (Yahoo Finance)',
    });
  }

  // USD/JPY (for JP stocks)
  if (macro.usdjpy != null && macro.usdjpyChange != null) {
    filledCount++;
    const ch = macro.usdjpyChange;
    if (isJP) {
      // Yen weakening (USDJPY rising) = positive for JP exporters
      const adj = ch > 3 ? 8 : ch > 1 ? 4 : ch > -1 ? 0 : ch > -3 ? -4 : -8;
      S += adj;
      reasons.push({
        name: `ドル円 ${macro.usdjpy.toFixed(1)}円 (1ヶ月 ${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%)`,
        score: adj,
        reason: ch > 0 ? '円安が輸出関連株に追い風（海外売上の円換算増加）' : '円高傾向で輸出株には逆風',
        source: 'USD/JPY (Yahoo Finance)',
      });
    } else {
      // For US stocks, JPY strength doesn't directly matter but USD matters
      reasons.push({
        name: `ドル円 ${macro.usdjpy.toFixed(1)}円`,
        score: 0,
        reason: '米国株への直接的影響は限定的',
        source: 'USD/JPY (Yahoo Finance)',
      });
    }
  }

  // 10-Year Treasury Yield
  if (macro.tnx != null) {
    filledCount++;
    const tnx = macro.tnx;
    const adj = tnx < 3.5 ? 8 : tnx < 4.0 ? 3 : tnx < 4.5 ? -2 : tnx < 5.0 ? -7 : -12;
    S += adj;
    reasons.push({
      name: `米10年債利回り ${tnx.toFixed(2)}%`,
      score: adj,
      reason: tnx < 4.0 ? '低金利環境がグロース株・テック株をサポート' : tnx < 4.5 ? '金利は中程度。グロース株への影響はやや中立' : '高金利がグロース株のバリュエーションに下押し圧力',
      source: '10Y Treasury (Yahoo Finance)',
    });
    if (tnx > 4.8) warnings.push(`⚠ 長期金利高止まり(${tnx.toFixed(2)}%)：グロース株バリュエーションへの逆風`);
  }

  const confidence = clamp(filledCount / 4, 0.3, 0.85);

  return {
    score: clamp(Math.round(S), 0, 100),
    confidence,
    reasons,
    warnings,
  };
}

export function toMacroDisplay(macro: MacroRaw): MacroDisplay {
  return {
    ...macro,
    updatedAt: new Date().toISOString(),
  };
}
