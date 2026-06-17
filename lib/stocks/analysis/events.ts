import { CategoryScore } from '../types';
import { clamp } from '../utils';

interface EventItem {
  date: string;
  type: string;
  impact: number;
  desc: string;
  isRisk?: boolean;
}

const EVENTS: Record<string, EventItem[]> = {
  MU: [
    { date: '2026-06-25', type: '決算発表', impact: 12, desc: 'Q3 FY2026 決算。HBM3E出荷量・粗利率が焦点' },
    { date: '2026-07-10', type: '投資家説明会', impact: 5, desc: 'HBM3E/HBM4 ロードマップ発表' },
    { date: '2026-09-24', type: '決算発表', impact: 10, desc: 'Q4 FY2026 決算' },
    { date: '2026-07-01', type: '規制リスク', impact: -8, desc: '中国輸出規制強化の可能性（HBM対象）', isRisk: true },
  ],
  MRVL: [
    { date: '2026-06-26', type: '決算発表', impact: 12, desc: 'Q1 FY2027 決算。カスタムASIC受注状況が焦点' },
    { date: '2026-09-25', type: '決算発表', impact: 10, desc: 'Q2 FY2027 決算' },
  ],
  NBIS: [
    { date: '2026-07-15', type: '決算発表', impact: 10, desc: 'Q2 2026 決算。GPU稼働率・収益化進捗が焦点' },
    { date: '2026-08-01', type: '希薄化リスク', impact: -8, desc: '株式発行による希薄化リスク', isRisk: true },
  ],
  AMAT: [
    { date: '2026-08-14', type: '決算発表', impact: 12, desc: 'Q3 FY2026 決算。中国売上と受注見通しが焦点' },
    { date: '2026-08-01', type: '規制リスク', impact: -6, desc: '対中輸出規制強化リスク', isRisk: true },
  ],
  LITE: [
    { date: '2026-08-06', type: '決算発表', impact: 10, desc: 'Q4 FY2026 決算。800G光モジュール出荷量が焦点' },
    { date: '2026-09-22', type: '展示会', impact: 5, desc: 'ECOC 2026 新製品発表' },
  ],
  SNDK: [
    { date: '2026-07-29', type: '決算発表', impact: 12, desc: 'Q2 CY2026 決算。WD分離後初の単独決算' },
    { date: '2026-09-01', type: '企業イベント', impact: 6, desc: '事業再編完了・新財務目標発表予定' },
  ],
  '285A': [
    { date: '2026-08-08', type: '決算発表', impact: 12, desc: '2026年3月期Q1決算。NAND市況と在庫調整が焦点' },
    { date: '2026-09-15', type: '増産', impact: 6, desc: '四日市第7棟量産開始予定' },
  ],
  '5016': [
    { date: '2026-08-06', type: '決算発表', impact: 10, desc: '2026年3月期Q1決算。銅箔需要と受注状況' },
  ],
  '5803': [
    { date: '2026-08-07', type: '決算発表', impact: 12, desc: '2026年3月期Q1決算。光ファイバー受注残と海底ケーブル' },
    { date: '2026-09-25', type: '展示会', impact: 4, desc: '光通信展2026 出展' },
  ],
  '5801': [
    { date: '2026-08-08', type: '決算発表', impact: 10, desc: '2026年3月期Q1決算。電力ケーブル受注と採算' },
  ],
  '5802': [
    { date: '2026-08-07', type: '決算発表', impact: 12, desc: '2026年3月期Q1決算。EV向けハーネス採算と台数' },
    { date: '2026-09-01', type: '配当権利', impact: 4, desc: '中間配当権利確定日' },
  ],
};

export function runEventAnalysis(stockId: string): CategoryScore {
  const events = EVENTS[stockId] ?? [];
  const today = new Date();
  const warnings: string[] = [];
  const reasons = [];
  let S = 50;
  let nextEarnings: string | null = null;

  for (const ev of events) {
    const evDate = new Date(ev.date);
    const days = (evDate.getTime() - today.getTime()) / 86400000;
    if (days < -14 || days > 90) continue;

    const proximity = days < 7 ? 1.3 : days < 21 ? 1.0 : days < 45 ? 0.8 : 0.6;
    const adj = Math.round(ev.impact * proximity);

    if (ev.type === '決算発表' && !nextEarnings && days >= 0) nextEarnings = ev.date;

    reasons.push({
      name: ev.type + (ev.date ? ` (${ev.date})` : ''),
      score: adj,
      reason: ev.desc,
      source: 'イベントカレンダー',
    });
    S += adj;
  }

  if (!events.length) warnings.push('イベントデータが未登録です');

  if (nextEarnings) {
    const d = (new Date(nextEarnings).getTime() - today.getTime()) / 86400000;
    if (d <= 14) warnings.push(`⚡ 決算直前（${nextEarnings}）：ボラティリティ上昇の可能性`);
    else if (d <= 30) warnings.push(`決算が近づいています（${nextEarnings}）`);
  } else {
    warnings.push('次回決算日が不明または90日以内なし');
  }

  return {
    score: clamp(Math.round(S), 0, 100),
    confidence: 0.65,
    reasons,
    warnings,
  };
}
