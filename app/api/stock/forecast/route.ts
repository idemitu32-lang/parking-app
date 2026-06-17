import { NextRequest, NextResponse } from 'next/server';
import { buildForecast } from '@/lib/stocks/analysis/forecast';
import { OHLCV } from '@/lib/stocks/types';

export const dynamic = 'force-dynamic';

async function fetchHistory(ticker: string): Promise<OHLCV[]> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - 2 * 365 * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${start}&period2=${end}&interval=1d&includePrePost=false`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    next: { revalidate: 1800 },
  });

  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status} for ${ticker}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('No data returned');

  const ts: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const opens: (number|null)[] = q.open ?? [];
  const highs: (number|null)[] = q.high ?? [];
  const lows: (number|null)[] = q.low ?? [];
  const closes: (number|null)[] = q.close ?? [];
  const volumes: (number|null)[] = q.volume ?? [];

  return ts.map((t, i) => ({
    date: new Date(t * 1000).toISOString().split('T')[0],
    open: opens[i] ?? null,
    high: highs[i] ?? null,
    low: lows[i] ?? null,
    close: closes[i] ?? null,
    volume: volumes[i] ?? null,
  })).filter(d => d.close !== null);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return NextResponse.json({ error: 'ticker parameter required' }, { status: 400 });
  }

  try {
    const data = await fetchHistory(ticker);
    const forecast = buildForecast(ticker, data);
    return NextResponse.json(forecast);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
