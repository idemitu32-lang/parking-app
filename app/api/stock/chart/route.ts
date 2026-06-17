import { NextRequest, NextResponse } from 'next/server';
import YahooFinanceClass from 'yahoo-finance2';
const yf = new (YahooFinanceClass as any)({ suppressNotices: ['yahooSurvey'] });

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  const range = searchParams.get('range') || '3mo';

  if (!ticker) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 });
  }

  const intervalMap: Record<string, '1d' | '1wk'> = {
    '1mo': '1d', '3mo': '1d', '6mo': '1d', '1y': '1d', '2y': '1wk',
  };
  const interval = intervalMap[range] ?? '1d';

  const end = new Date();
  const start = new Date();
  const rangeMap: Record<string, number> = { '1mo': 31, '3mo': 92, '6mo': 183, '1y': 366, '2y': 731 };
  start.setDate(start.getDate() - (rangeMap[range] ?? 92));

  try {
    const result = await yf.chart(ticker, {
      period1: start,
      period2: end,
      interval,
    });

    const quotes = result.quotes
      .filter((q: any) => q.close != null)
      .map((q: any) => ({
        date: q.date instanceof Date ? q.date.toISOString().slice(0, 10) : String(q.date).slice(0, 10),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume ?? 0,
      }));

    return NextResponse.json({ ticker, currency: result.meta.currency, quotes });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
