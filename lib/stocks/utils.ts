import { Direction } from './types';

export function safe(v: number | null | undefined, fallback = 0): number {
  if (v == null || !isFinite(v) || isNaN(v)) return fallback;
  return v;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function pct(a: number, b: number): number | null {
  if (!b || !isFinite(a / b)) return null;
  return (a / b - 1) * 100;
}

export function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function scoreToDirection(score: number): Direction {
  if (score >= 80) return 'strong_bullish';
  if (score >= 65) return 'bullish';
  if (score >= 55) return 'slightly_bullish';
  if (score >= 45) return 'neutral';
  if (score >= 35) return 'slightly_bearish';
  if (score >= 20) return 'bearish';
  return 'strong_bearish';
}

export const DIRECTION_LABEL: Record<Direction, string> = {
  strong_bullish:   '強い強気 ▲▲',
  bullish:          '強気 ▲',
  slightly_bullish: 'やや強気 △',
  neutral:          '中立 ─',
  slightly_bearish: 'やや弱気 ▽',
  bearish:          '弱気 ▼',
  strong_bearish:   '強い弱気 ▼▼',
};

export const DIRECTION_COLOR: Record<Direction, string> = {
  strong_bullish:   '#10b981',
  bullish:          '#34d399',
  slightly_bullish: '#6ee7b7',
  neutral:          '#94a3b8',
  slightly_bearish: '#fca5a5',
  bearish:          '#f87171',
  strong_bearish:   '#ef4444',
};

export function fmt2(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || isNaN(v)) return '—';
  return v.toFixed(2);
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null || !isFinite(v) || isNaN(v)) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(digits) + '%';
}
