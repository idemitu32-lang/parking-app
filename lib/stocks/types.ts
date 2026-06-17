export interface OHLCV {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

export type TimeHorizon = 'short' | 'medium' | 'long';

export type Direction =
  | 'strong_bullish' | 'bullish' | 'slightly_bullish'
  | 'neutral'
  | 'slightly_bearish' | 'bearish' | 'strong_bearish';

export interface ScoreReason {
  name: string;
  score: number;
  reason: string;
  source?: string;
}

export interface CategoryScore {
  score: number;
  confidence: number;
  reasons: ScoreReason[];
  warnings: string[];
}

export interface ForecastRange {
  downside: number;
  base: number;
  upside: number;
}

export interface HorizonForecast {
  horizon: TimeHorizon;
  score: number;
  direction: Direction;
  confidence: number;
  expectedRange: ForecastRange;
  positiveFactors: ScoreReason[];
  negativeFactors: ScoreReason[];
  warnings: string[];
}

export interface BacktestResult {
  verified: boolean;
  period: string;
  sampleSize: number;
  note?: string;
  oneMonth?: {
    winRate: number;
    avgReturn: number;
    medianReturn: number;
    maxDrawdown: number;
  };
  signalPerformance: Array<{
    signal: string;
    count: number;
    avgReturn1m: number;
    winRate1m: number;
  }>;
}

export interface StockForecast {
  symbol: string;
  name: string;
  updatedAt: string;
  dataQuality: {
    score: number;
    missingFields: string[];
    warnings: string[];
  };
  categoryScores: {
    technical: CategoryScore;
    theme: CategoryScore;
    macro: CategoryScore;
    event: CategoryScore;
    fundamental: CategoryScore;
  };
  forecast: {
    shortTerm: HorizonForecast;
    mediumTerm: HorizonForecast;
    longTerm: HorizonForecast;
  };
  backtest: BacktestResult;
}
