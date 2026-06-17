import { NextRequest, NextResponse } from 'next/server';

const RANGE_MAP: Record<string, number> = { '1mo':31,'3mo':92,'6mo':183,'1y':366,'2y':731 };
const INTERVAL_MAP: Record<string, string> = { '1mo':'1d','3mo':'1d','6mo':'1d','1y':'1d','2y':'1wk' };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  const range  = searchParams.get('range') || '3mo';

  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const interval = INTERVAL_MAP[range] ?? '1d';
  const end = Math.floor(Date.now() / 1000);
  const start = end - (RANGE_MAP[range] ?? 92) * 86400;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${start}&period2=${end}&interval=${interval}&includePrePost=false`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error('No data');

    const timestamps: number[] = result.timestamp ?? [];
    const q = result.indicators.quote[0];
    const quotes = timestamps
      .map((ts, i) => ({
        date:   new Date(ts * 1000).toISOString().slice(0, 10),
        open:   q.open?.[i]   ?? null,
        high:   q.high?.[i]   ?? null,
        low:    q.low?.[i]    ?? null,
        close:  q.close?.[i]  ?? null,
        volume: q.volume?.[i] ?? 0,
      }))
      .filter(d => d.close != null);

    return NextResponse.json({ ticker, currency: result.meta.currency, quotes });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
