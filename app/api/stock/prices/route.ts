import { NextRequest, NextResponse } from 'next/server';

const TICKERS = ['MU','MRVL','NBIS','AMAT','LITE','SNDK','285A.T','5016.T','5803.T','5801.T','5802.T'];

async function fetchQuote(ticker: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d&includePrePost=false`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('No data');
  const quotes = result.indicators.quote[0];
  const closes = quotes.close.filter((v: any) => v != null);
  const n = closes.length;
  const price = closes[n - 1];
  const prev  = closes[n - 2] ?? closes[n - 1];
  const change = price - prev;
  const changePct = (change / prev) * 100;
  const meta = result.meta;
  return {
    ticker,
    price,
    change,
    changePct,
    currency: meta.currency,
    high52: meta.fiftyTwoWeekHigh,
    low52:  meta.fiftyTwoWeekLow,
    volume: quotes.volume?.filter((v: any) => v != null).at(-1) ?? 0,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tickerParam = searchParams.get('tickers');
  const tickers = tickerParam ? tickerParam.split(',') : TICKERS;

  const results = await Promise.allSettled(tickers.map(fetchQuote));

  const data: Record<string, any> = {};
  results.forEach((r, i) => {
    const t = tickers[i];
    if (r.status === 'fulfilled') data[t] = r.value;
    else data[t] = { ticker: t, error: (r.reason as Error).message };
  });

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
  });
}
