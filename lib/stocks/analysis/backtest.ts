import { OHLCV, BacktestResult } from '../types';
import { safe, median } from '../utils';
import { quickTechScore } from './technical';

function closes(data: OHLCV[]): number[] {
  return data.map(d => safe(d.close)).filter(v => v > 0);
}

export function runBacktest(data: OHLCV[]): BacktestResult {
  const c = closes(data);
  if (c.length < 60) {
    return {
      verified: false,
      period: 'データ不足',
      sampleSize: c.length,
      note: `バックテストには最低60日分のデータが必要です（現在${c.length}日分）`,
      signalPerformance: [],
    };
  }

  const windowSize = 30;
  const holdDays = 21;
  const results: { ret: number; signal: string }[] = [];

  for (let i = windowSize; i < c.length - holdDays; i++) {
    const slice: OHLCV[] = data.slice(i - windowSize, i).map((d, j) => ({
      ...d,
      close: c[i - windowSize + j],
    }));
    const score = quickTechScore(slice);
    const entryPrice = c[i];
    const exitPrice = c[i + holdDays];
    if (!entryPrice || !exitPrice) continue;
    const ret = (exitPrice / entryPrice - 1) * 100;
    const signal = score >= 65 ? 'bullish' : score <= 35 ? 'bearish' : 'neutral';
    results.push({ ret, signal });
  }

  if (results.length < 10) {
    return {
      verified: false,
      period: `過去${data.length}日`,
      sampleSize: results.length,
      note: 'サンプル数不足のためバックテスト結果は参考値です',
      signalPerformance: [],
    };
  }

  const rets = results.map(r => r.ret);
  const avgReturn = rets.reduce((a, b) => a + b, 0) / rets.length;
  const winRate = (rets.filter(r => r > 0).length / rets.length) * 100;
  const medianReturn = median(rets);
  const runningMax: number[] = [];
  let peak = -Infinity;
  for (const r of rets) {
    peak = Math.max(peak, r);
    runningMax.push(peak - r);
  }
  const maxDrawdown = Math.max(...runningMax, 0);

  const signals = ['bullish', 'bearish', 'neutral'];
  const signalPerformance = signals.map(sig => {
    const group = results.filter(r => r.signal === sig);
    if (!group.length) return null;
    const gr = group.map(r => r.ret);
    return {
      signal: sig === 'bullish' ? '強気シグナル' : sig === 'bearish' ? '弱気シグナル' : '中立シグナル',
      count: group.length,
      avgReturn1m: parseFloat((gr.reduce((a, b) => a + b, 0) / gr.length).toFixed(2)),
      winRate1m: parseFloat(((gr.filter(r => r > 0).length / gr.length) * 100).toFixed(1)),
    };
  }).filter(Boolean) as BacktestResult['signalPerformance'];

  const startDate = data[windowSize]?.date ?? '不明';
  const endDate = data[data.length - holdDays - 1]?.date ?? '不明';

  return {
    verified: true,
    period: `${startDate} 〜 ${endDate}`,
    sampleSize: results.length,
    oneMonth: {
      winRate: parseFloat(winRate.toFixed(1)),
      avgReturn: parseFloat(avgReturn.toFixed(2)),
      medianReturn: parseFloat(medianReturn.toFixed(2)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    },
    signalPerformance,
  };
}
