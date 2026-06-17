import { NextRequest, NextResponse } from 'next/server';
import { buildForecast } from '@/lib/stocks/analysis/forecast';
import { OHLCV } from '@/lib/stocks/types';
import { QuoteSummaryRaw } from '@/lib/stocks/analysis/fundamental';
import { MacroRaw } from '@/lib/stocks/analysis/macro';
import { NewsRaw, processNews } from '@/lib/stocks/analysis/news';

export const dynamic = 'force-dynamic';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
};

async function fetchHistory(ticker: string): Promise<OHLCV[]> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - 2 * 365 * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${start}&period2=${end}&interval=1d&includePrePost=false`;
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`Yahoo Finance chart: HTTP ${res.status} for ${ticker}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('No chart data returned');
  const ts: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  return ts.map((t, i) => ({
    date: new Date(t * 1000).toISOString().split('T')[0],
    open: q.open?.[i] ?? null,
    high: q.high?.[i] ?? null,
    low: q.low?.[i] ?? null,
    close: q.close?.[i] ?? null,
    volume: q.volume?.[i] ?? null,
  })).filter(d => d.close !== null);
}

async function fetchQuoteSummary(ticker: string): Promise<QuoteSummaryRaw | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=defaultKeyStatistics,financialData,summaryDetail`;
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    return result ?? null;
  } catch {
    return null;
  }
}

async function fetchMacroTicker(ticker: string, period = '1mo'): Promise<number[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${period}&interval=1d&includePrePost=false`;
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 900 } });
    if (!res.ok) return [];
    const json = await res.json();
    const closes: number[] = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    return closes.filter((v): v is number => v != null && isFinite(v));
  } catch {
    return [];
  }
}

async function fetchMacro(): Promise<MacroRaw> {
  const [vixData, soxData, usdjpyData, tnxData, spxData] = await Promise.all([
    fetchMacroTicker('^VIX', '1mo'),
    fetchMacroTicker('^SOX', '1mo'),
    fetchMacroTicker('USDJPY=X', '1mo'),
    fetchMacroTicker('^TNX', '1mo'),
    fetchMacroTicker('^GSPC', '1mo'),
  ]);

  const last = (arr: number[]) => arr.at(-1);
  const first = (arr: number[]) => arr[0];
  const chgPct = (arr: number[]) => {
    const f = first(arr), l = last(arr);
    if (!f || !l) return undefined;
    return (l / f - 1) * 100;
  };
  const dayChg = (arr: number[]) => {
    if (arr.length < 2) return undefined;
    const f = arr.at(-2)!, l = arr.at(-1)!;
    return (l / f - 1) * 100;
  };

  return {
    vix: last(vixData),
    vixChange: dayChg(vixData),
    sox: last(soxData),
    soxChange1m: chgPct(soxData),
    usdjpy: last(usdjpyData),
    usdjpyChange: chgPct(usdjpyData),
    tnx: last(tnxData),
    tnxChange: dayChg(tnxData),
    sp500Change1m: chgPct(spxData),
  };
}

async function fetchNews(ticker: string): Promise<NewsRaw[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=12&quotesCount=0&enableFuzzyQuery=false`;
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.news ?? [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  if (!ticker) return NextResponse.json({ error: 'ticker parameter required' }, { status: 400 });

  try {
    const [data, quoteSummary, macroRaw, rawNews] = await Promise.all([
      fetchHistory(ticker),
      fetchQuoteSummary(ticker),
      fetchMacro(),
      fetchNews(ticker),
    ]);

    const newsItems = processNews(rawNews);
    const forecast = buildForecast(ticker, data, quoteSummary, macroRaw, newsItems);
    return NextResponse.json(forecast);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
