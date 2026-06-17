import { NextRequest, NextResponse } from 'next/server';
import YahooFinanceClass from 'yahoo-finance2';
const yf = new (YahooFinanceClass as any)({ suppressNotices: ['yahooSurvey'] });

const TICKERS = ['MU','MRVL','NBIS','AMAT','LITE','SNDK','285A.T','5016.T','5803.T','5801.T','5802.T'];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tickerParam = searchParams.get('tickers');
  const tickers = tickerParam ? tickerParam.split(',') : TICKERS;

  const results = await Promise.allSettled(
    tickers.map(async ticker => {
      const q = await yf.quote(ticker);
      return {
        ticker,
        price: q.regularMarketPrice,
        change: q.regularMarketChange,
        changePct: q.regularMarketChangePercent,
        volume: q.regularMarketVolume,
        high52: q.fiftyTwoWeekHigh,
        low52: q.fiftyTwoWeekLow,
        currency: q.currency,
      };
    })
  );

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
