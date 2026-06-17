import { CategoryScore, NewsItem } from '../types';
import { clamp } from '../utils';

// Re-export NewsItem so forecast.ts can import it from this module
export type { NewsItem } from '../types';

export interface NewsRaw {
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
}

const POSITIVE_KEYWORDS = [
  'beat', 'record', 'growth', 'surge', 'upgrade', 'outperform', 'buy', 'strong',
  'expansion', 'demand', 'win', 'gain', 'rally', 'rises', 'soars', 'profit',
  '上方修正', '増益', '増収', '最高益', '好調', '需要', '受注', '上昇', '急伸',
  'bullish', 'positive', 'AI', 'cloud', 'データセンター', '光ファイバー',
];

const NEGATIVE_KEYWORDS = [
  'miss', 'cut', 'downgrade', 'underperform', 'sell', 'decline', 'fall', 'drop',
  'warn', 'risk', 'concern', 'loss', 'weak', 'investigation', 'fine', 'sanction',
  '下方修正', '減益', '減収', '赤字', '軟調', '在庫', '規制', '下落', '急落',
  'bearish', 'negative', '制裁', '輸出規制', '関税',
];

function scoreSentiment(title: string): { sentiment: 'positive'|'neutral'|'negative'; score: number } {
  const lower = title.toLowerCase();
  let pos = 0;
  let neg = 0;
  for (const kw of POSITIVE_KEYWORDS) { if (lower.includes(kw.toLowerCase())) pos++; }
  for (const kw of NEGATIVE_KEYWORDS) { if (lower.includes(kw.toLowerCase())) neg++; }
  const net = pos - neg;
  if (net >= 1) return { sentiment: 'positive', score: Math.min(net, 3) };
  if (net <= -1) return { sentiment: 'negative', score: Math.max(net, -3) };
  return { sentiment: 'neutral', score: 0 };
}

export function processNews(rawItems: NewsRaw[]): NewsItem[] {
  return rawItems.slice(0, 12).map(item => {
    const { sentiment, score } = scoreSentiment(item.title);
    return {
      title: item.title,
      publisher: item.publisher,
      link: item.link,
      publishedAt: new Date(item.providerPublishTime * 1000).toISOString(),
      sentiment,
      sentimentScore: score,
    };
  });
}

export function runNewsAnalysis(items: NewsItem[]): CategoryScore {
  if (!items.length) {
    return {
      score: 50,
      confidence: 0.2,
      reasons: [],
      warnings: ['ニュースデータが取得できませんでした'],
    };
  }

  // Recency weighting: news within 3 days = 1.5x, within 7 days = 1.0x, older = 0.5x
  const now = Date.now();
  let weightedSentiment = 0;
  let totalWeight = 0;
  const posItems: NewsItem[] = [];
  const negItems: NewsItem[] = [];

  for (const item of items) {
    const ageDays = (now - new Date(item.publishedAt).getTime()) / 86400000;
    const weight = ageDays < 3 ? 1.5 : ageDays < 7 ? 1.0 : 0.5;
    weightedSentiment += item.sentimentScore * weight;
    totalWeight += weight;
    if (item.sentiment === 'positive') posItems.push(item);
    if (item.sentiment === 'negative') negItems.push(item);
  }

  const avgSentiment = totalWeight > 0 ? weightedSentiment / totalWeight : 0;
  // Map avgSentiment (-3 to +3) to score (0-100), center 50
  const score = clamp(Math.round(50 + avgSentiment * 12), 0, 100);

  const reasons = [];
  if (posItems.length) {
    reasons.push({
      name: `ポジティブニュース ${posItems.length}件`,
      score: posItems.length * 3,
      reason: posItems[0].title.slice(0, 80),
      source: posItems[0].publisher,
    });
  }
  if (negItems.length) {
    reasons.push({
      name: `ネガティブニュース ${negItems.length}件`,
      score: -negItems.length * 3,
      reason: negItems[0].title.slice(0, 80),
      source: negItems[0].publisher,
    });
  }

  const warnings: string[] = [];
  if (negItems.length > posItems.length * 2) warnings.push('ネガティブニュースが多い');

  return {
    score,
    confidence: clamp(items.length / 10, 0.2, 0.75),
    reasons,
    warnings,
  };
}
