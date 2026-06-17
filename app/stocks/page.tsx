'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

// ============================================================
// Types
// ============================================================
interface OHLC { date: string; open: number; high: number; low: number; close: number; volume: number; }
interface StockDef { id: string; name: string; en: string; ticker: string; market: 'US'|'JP'; color: string; sector: string; }
interface PriceData { price: number; changePct: number; change: number; high52: number; low52: number; currency: string; error?: string; }

interface ScoreReason { name: string; score: number; reason: string; source?: string; }
interface CategoryScore { score: number; confidence: number; reasons: ScoreReason[]; warnings: string[]; }
interface ForecastRange { downside: number; base: number; upside: number; }
interface HorizonForecast { horizon: string; score: number; direction: string; confidence: number; expectedRange: ForecastRange; positiveFactors: ScoreReason[]; negativeFactors: ScoreReason[]; warnings: string[]; }
interface BacktestResult { verified: boolean; period: string; sampleSize: number; note?: string; oneMonth?: { winRate: number; avgReturn: number; medianReturn: number; maxDrawdown: number; }; signalPerformance: Array<{ signal: string; count: number; avgReturn1m: number; winRate1m: number; }>; }
interface FundamentalDisplay { marketCap?: number; currency?: string; forwardPE?: number; trailingPE?: number; revenueGrowth?: number; grossMargin?: number; operatingMargin?: number; returnOnEquity?: number; pegRatio?: number; debtToEquity?: number; dividendYield?: number; beta?: number; eps?: number; priceToBook?: number; }
interface MacroDisplay { vix?: number; vixChange?: number; sox?: number; soxChange1m?: number; usdjpy?: number; usdjpyChange?: number; tnx?: number; tnxChange?: number; sp500Change1m?: number; updatedAt?: string; }
interface NewsItem { title: string; publisher: string; link: string; publishedAt: string; sentiment: 'positive'|'neutral'|'negative'; sentimentScore: number; }
interface StockForecast { symbol: string; name: string; updatedAt: string; dataQuality: { score: number; missingFields: string[]; warnings: string[]; }; categoryScores: { technical: CategoryScore; theme: CategoryScore; macro: CategoryScore; event: CategoryScore; fundamental: CategoryScore; news: CategoryScore; }; forecast: { shortTerm: HorizonForecast; mediumTerm: HorizonForecast; longTerm: HorizonForecast; }; backtest: BacktestResult; fundamentalDisplay?: FundamentalDisplay; macroDisplay?: MacroDisplay; newsItems?: NewsItem[]; }

// ============================================================
// 銘柄マスタ
// ============================================================
const STOCKS: StockDef[] = [
  { id:'MU',   name:'マイクロン',           en:'Micron Technology',      ticker:'MU',     market:'US', color:'#3b82f6', sector:'半導体・DRAM/NAND' },
  { id:'MRVL', name:'マーベルテクノロジー', en:'Marvell Technology',     ticker:'MRVL',   market:'US', color:'#06b6d4', sector:'半導体・データセンター' },
  { id:'NBIS', name:'ネビウスグループ',      en:'Nebius Group',           ticker:'NBIS',   market:'US', color:'#8b5cf6', sector:'AI・クラウドインフラ' },
  { id:'AMAT', name:'アプライドマテリアルズ',en:'Applied Materials',      ticker:'AMAT',   market:'US', color:'#f59e0b', sector:'半導体製造装置' },
  { id:'LITE', name:'ルメンタム',           en:'Lumentum Holdings',      ticker:'LITE',   market:'US', color:'#10b981', sector:'光学部品・通信' },
  { id:'SNDK', name:'サンディスク',         en:'SanDisk',                ticker:'SNDK',   market:'US', color:'#ef4444', sector:'NAND・ストレージ' },
  { id:'6600', name:'キオクシア',           en:'Kioxia Holdings',        ticker:'285A.T', market:'JP', color:'#f97316', sector:'NAND型フラッシュ' },
  { id:'5016', name:'ＪＸ金属',             en:'JX Metals',              ticker:'5016.T', market:'JP', color:'#84cc16', sector:'非鉄金属・銅箔' },
  { id:'5803', name:'フジクラ',             en:'Fujikura',               ticker:'5803.T', market:'JP', color:'#ec4899', sector:'電線・光ファイバー' },
  { id:'5801', name:'古川電工',             en:'Furukawa Electric',      ticker:'5801.T', market:'JP', color:'#14b8a6', sector:'電線・ケーブル' },
  { id:'5802', name:'住友電工',             en:'Sumitomo Electric',      ticker:'5802.T', market:'JP', color:'#a78bfa', sector:'電線・ハーネス' },
];

// ============================================================
// イベントデータ
// ============================================================
const EVENTS: Record<string, {date:string;type:string;color:string;desc:string}[]> = {
  MU:   [
    { date:'2026-06-25', type:'決算発表', color:'#3b82f6', desc:'Q3 FY2026 決算 (予想EPS: $1.58)' },
    { date:'2026-07-10', type:'投資家説明会', color:'#8b5cf6', desc:'HBM3E/HBM4 ロードマップ発表' },
    { date:'2026-09-24', type:'決算発表', color:'#3b82f6', desc:'Q4 FY2026 決算 (予想EPS: $1.82)' },
  ],
  MRVL: [
    { date:'2026-06-26', type:'決算発表', color:'#3b82f6', desc:'Q1 FY2027 決算 (予想EPS: $0.62)' },
    { date:'2026-09-25', type:'決算発表', color:'#3b82f6', desc:'Q2 FY2027 決算' },
  ],
  NBIS: [
    { date:'2026-07-15', type:'決算発表', color:'#3b82f6', desc:'Q2 2026 決算 (AI GPU クラスタ需要)' },
    { date:'2026-10-15', type:'決算発表', color:'#3b82f6', desc:'Q3 2026 決算' },
  ],
  AMAT: [
    { date:'2026-08-14', type:'決算発表', color:'#3b82f6', desc:'Q3 FY2026 決算 (予想EPS: $2.34)' },
    { date:'2026-11-13', type:'決算発表', color:'#3b82f6', desc:'Q4 FY2026 決算' },
  ],
  LITE: [
    { date:'2026-08-06', type:'決算発表', color:'#3b82f6', desc:'Q4 FY2026 決算 (AI光モジュール需要)' },
    { date:'2026-09-22', type:'展示会',   color:'#f59e0b', desc:'ECOC 2026 — 光通信カンファレンス' },
  ],
  SNDK: [
    { date:'2026-07-29', type:'決算発表', color:'#3b82f6', desc:'Q2 CY2026 決算 (WD分離後初決算)' },
  ],
  '6600': [
    { date:'2026-08-08', type:'決算発表', color:'#3b82f6', desc:'2026年3月期 第1四半期決算' },
    { date:'2026-11-12', type:'決算発表', color:'#3b82f6', desc:'2026年3月期 第2四半期決算' },
  ],
  '5016': [
    { date:'2026-08-06', type:'決算発表', color:'#3b82f6', desc:'2026年3月期 第1四半期決算' },
  ],
  '5803': [
    { date:'2026-08-07', type:'決算発表', color:'#3b82f6', desc:'2026年3月期 第1四半期決算' },
    { date:'2026-11-05', type:'決算発表', color:'#3b82f6', desc:'2026年3月期 第2四半期決算' },
  ],
  '5801': [
    { date:'2026-08-08', type:'決算発表', color:'#3b82f6', desc:'2026年3月期 第1四半期決算' },
  ],
  '5802': [
    { date:'2026-08-07', type:'決算発表', color:'#3b82f6', desc:'2026年3月期 第1四半期決算' },
    { date:'2026-09-01', type:'配当権利', color:'#10b981', desc:'中間配当権利確定日' },
  ],
};

const ANALYSIS: Record<string, {bull:string;bear:string;thesis:string}> = {
  MU:   { bull:'HBM3E大量供給でデータセンター向け需要急増。AI推論サーバー1台あたりのDRAM搭載量拡大。CHIPS法補助金受給確定。', bear:'中国規制リスク継続。PC/スマホ市場の在庫調整。Samsung・SKHynixとの価格競争激化。', thesis:'2026年後半にNAND価格回復+HBM4本格採用が重なるスーパーサイクル入りが期待。目標株価 $120〜$160。' },
  MRVL: { bull:'カスタムASIC（XPU）でAmazon・Google向けに大型受注。5nm→3nmで電力効率改善。データセンター向け光DSPが高成長。', bear:'サイクル依存度高。インテルとの競争。カスタムASICは1〜2社依存リスク。', thesis:'AIインフラ拡大の構造的受益者。FY2027にEPS $3超が視野。' },
  NBIS: { bull:'YandexからスピンアウトしたAI/ML特化クラウド。欧州・中東のAI規制対応需要で差別化。NVIDIA H100/H200 GPU大量保有。', bear:'収益化初期段階で赤字継続。ロシア制裁リスクの残影。', thesis:'欧州AI主権需要の受益者。2027年黒字化目標に向けて進捗が鍵。' },
  AMAT: { bull:'GAA移行でエピタキシャル成長装置需要急増。Ebeam検査でのシェア拡大。', bear:'輸出規制強化による中国売上（約25%）リスク。顧客の設備投資サイクル依存。', thesis:'半導体投資の恩恵が最も大きい川上企業。GAA移行は2026〜2027年の需要ドライバー。' },
  LITE: { bull:'800G/1.6T光トランシーバーへのアップグレード需要。AI/ML向けデータセンター内光インターコネクト急増。', bear:'通信キャリア向け需要が依然低調。在庫消化が完全に終わっていない。', thesis:'AIネットワーク需要で2026年後半から需給逼迫。EPS回復ストーリーは説得力がある。' },
  SNDK: { bull:'WD分離によるフォーカス経営でNAND専業に。キオクシアとの提携でコスト効率化。', bear:'独立後の財務基盤が不透明。NAND価格は2026年前半まで回復遅延の見方も。', thesis:'分社化による再評価余地大。NANDサイクル回復と重なれば2倍ポテンシャル。' },
  '6600':{ bull:'TSMCとのJV検討でHBM参入。1α/1β世代NAND量産開始。エンタープライズSSD急伸。', bear:'中国市場での競争激化。', thesis:'国内NAND唯一の上場銘柄。政府支援と構造需要回復で長期強気。' },
  '5016':{ bull:'半導体パッケージ基板向け銅箔需要急増。EV/電池向け電解銅箔でシェアトップ級。', bear:'銅価格変動リスク。中国メーカーとのコスト競争。', thesis:'データセンター＋EV双方の恩恵。CCL向け需要は構造的拡大局面。' },
  '5803':{ bull:'AI/データセンター向け光ファイバーケーブルでグローバルトップシェア。海底ケーブル事業急拡大。', bear:'原材料コスト上昇。', thesis:'AIとエネルギートランジションの2重恩恵。2026年に利益過去最高更新の見込み。' },
  '5801':{ bull:'電力インフラ更新需要。EV充電インフラ向けケーブル受注増。', bear:'電線市況の変動。銅・アルミ価格への感応度。', thesis:'電力インフラ更新サイクルの10年トレンドに乗る。安定配当と成長の両立。' },
  '5802':{ bull:'自動車ハーネスで世界シェアトップ。EV化でハーネス単価上昇。データセンター電力ケーブル急増。', bear:'自動車生産台数の変動リスク。原材料コスト転嫁のラグ。', thesis:'EV移行の構造的受益者。ハーネス単価上昇と電力インフラ需要が下支え。' },
};

// ============================================================
// Technical Analysis helpers
// ============================================================
function calcSMA(data: OHLC[], period: number) {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const s = data.slice(i - period + 1, i + 1).reduce((a, d) => a + d.close, 0);
    return s / period;
  });
}
function calcEMA(closes: number[], period: number) {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = closes[0];
  for (const c of closes) { ema = c * k + ema * (1 - k); result.push(ema); }
  return result;
}
function calcRSI(data: OHLC[], period = 14) {
  const gains: number[] = [], losses: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const d = data[i].close - data[i-1].close;
    gains.push(d > 0 ? d : 0); losses.push(d < 0 ? -d : 0);
  }
  const result: (number|null)[] = [null];
  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    const ag = gains.slice(i-period+1,i+1).reduce((a,v)=>a+v,0)/period;
    const al = losses.slice(i-period+1,i+1).reduce((a,v)=>a+v,0)/period;
    result.push(al === 0 ? 100 : 100 - 100/(1+ag/al));
  }
  return result;
}
function calcMACD(data: OHLC[]) {
  const closes = data.map(d => d.close);
  const ema12 = calcEMA(closes, 12), ema26 = calcEMA(closes, 26);
  const macd = ema12.map((v,i) => v - ema26[i]);
  const sig = calcEMA(macd, 9);
  return { macd, sig, hist: macd.map((v,i) => v - sig[i]) };
}
function calcBB(data: OHLC[], period = 20) {
  const sma = calcSMA(data, period);
  return data.map((_, i) => {
    if (!sma[i]) return { upper:null, mid:null, lower:null };
    const sl = data.slice(Math.max(0,i-period+1),i+1);
    const sd = Math.sqrt(sl.reduce((a,d)=>a+(d.close-sma[i]!)**2,0)/sl.length);
    return { upper: sma[i]!+2*sd, mid:sma[i]!, lower:sma[i]!-2*sd };
  });
}
function predictPrices(data: OHLC[]) {
  const n = Math.min(data.length, 60);
  const sl = data.slice(-n);
  const xs = sl.map((_,i)=>i), ys = sl.map(d=>d.close);
  const xM = xs.reduce((a,v)=>a+v,0)/n, yM = ys.reduce((a,v)=>a+v,0)/n;
  const slope = xs.reduce((a,x,i)=>a+(x-xM)*(ys[i]-yM),0)/xs.reduce((a,x)=>a+(x-xM)**2,0);
  const intercept = yM - slope*xM;
  const sma20 = calcSMA(data,20).filter(v=>v!=null).at(-1) ?? 0;
  const sma50 = calcSMA(data,Math.min(50,data.length)).filter(v=>v!=null).at(-1) ?? 0;
  const rsi = calcRSI(data).filter(v=>v!=null).at(-1) ?? 50;
  const lastClose = data.at(-1)!.close;
  const mom = sma20 && sma50 ? (sma20>sma50?1.01:0.99) : 1;
  const rsiM = rsi>70?0.98:rsi<30?1.02:1;
  const predict = (d:number) => (intercept+slope*(n+d))*mom*rsiM;
  return {
    '1mo': { price: predict(21), conf: 80 },
    '3mo': { price: predict(63), conf: 65 },
    '6mo': { price: predict(126), conf: 50 },
    trend: slope > 0 ? 'UP' : 'DOWN',
    rsi, lastClose,
    sma20, sma50,
  };
}

// ============================================================
// Format helpers
// ============================================================
const fmtPrice = (v:number|null|undefined, cur:string) => {
  if (v == null || isNaN(v)) return '—';
  if (cur === 'JPY') return '¥' + Math.round(v).toLocaleString('ja-JP');
  return '$' + v.toFixed(2);
};
const fmtPct = (v:number|null|undefined) => {
  if (v == null || isNaN(v)) return '—';
  return (v>=0?'+':'')+v.toFixed(2)+'%';
};
const pctCls = (v:number|null|undefined) => !v ? 'text-slate-400' : v>0 ? 'text-emerald-400' : 'text-red-400';

// ============================================================
// Chart rendering (vanilla canvas via useEffect)
// ============================================================
declare global { interface Window { Chart: any; } }

function useChartJS() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.Chart) { setReady(true); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);
  return ready;
}

function destroyChart(id: string) {
  if (!window.Chart) return;
  const existing = window.Chart.getChart(id);
  if (existing) existing.destroy();
}

const CHART_OPTS = (yTitle?: string, yMin?: number, yMax?: number) => ({
  responsive: true, maintainAspectRatio: true,
  interaction: { mode:'index', intersect:false },
  plugins: {
    legend: { labels:{ color:'#94a3b8', font:{ size:11 }, boxWidth:12 } },
    tooltip: { backgroundColor:'#1a2332', borderColor:'#1e3a5f', borderWidth:1, titleColor:'#e2e8f0', bodyColor:'#94a3b8' },
  },
  scales: {
    x: { ticks:{ color:'#475569', font:{size:10}, maxTicksLimit:8, maxRotation:0 }, grid:{ color:'rgba(30,58,95,0.4)' } },
    y: { ticks:{ color:'#475569', font:{size:10} }, grid:{ color:'rgba(30,58,95,0.4)' }, min:yMin, max:yMax,
      title: yTitle ? { display:true, text:yTitle, color:'#475569', font:{size:10} } : { display:false } },
  }
});

// ============================================================
// Main Component
// ============================================================
export default function StocksPage() {
  const chartReady = useChartJS();
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [selectedId, setSelectedId] = useState<string>('MU');
  const [ohlc, setOhlc] = useState<OHLC[]>([]);
  const [period, setPeriod] = useState('3mo');
  const [tab, setTab] = useState<'chart'|'forecast'|'events'|'analysis'|'news'>('chart');
  const [forecast, setForecast] = useState<StockForecast | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState('');
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [compareId, setCompareId] = useState<string | null>(null);
  const [compareOhlc, setCompareOhlc] = useState<OHLC[]>([]);
  const chartMounted = useRef(false);

  // Load watchlist from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('stock_watchlist');
      if (saved) setWatchlist(new Set(JSON.parse(saved)));
    } catch {}
  }, []);

  const toggleWatchlist = (id: string) => {
    setWatchlist(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('stock_watchlist', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const selected = STOCKS.find(s => s.id === selectedId)!;
  const cur = selected.market === 'JP' ? 'JPY' : 'USD';
  const fp = (v: number|null|undefined) => fmtPrice(v, cur);

  // Fetch all prices
  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/stock/prices');
      const data = await res.json();
      // Map by id
      const mapped: Record<string, PriceData> = {};
      for (const s of STOCKS) {
        const d = data[s.ticker];
        if (d && !d.error) mapped[s.id] = d;
        else if (d?.error) mapped[s.id] = { ...d, price: 0, changePct: 0, change: 0, high52: 0, low52: 0, currency: '' };
      }
      setPrices(mapped);
      setLastUpdate(new Date().toLocaleTimeString('ja-JP'));
    } catch(e) {}
  }, []);

  // Fetch chart
  const fetchChart = useCallback(async (id: string, p: string) => {
    const s = STOCKS.find(x=>x.id===id)!;
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/stock/chart?ticker=${encodeURIComponent(s.ticker)}&range=${p}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOhlc(data.quotes);
    } catch(e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchForecast = useCallback(async (id: string) => {
    const s = STOCKS.find(x => x.id === id)!;
    setForecastLoading(true); setForecastError(''); setForecast(null);
    try {
      const res = await fetch(`/api/stock/forecast?ticker=${encodeURIComponent(s.ticker)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setForecast(data);
    } catch (e: any) {
      setForecastError(e.message);
    } finally {
      setForecastLoading(false);
    }
  }, []);

  const fetchCompareChart = useCallback(async (id: string, p: string) => {
    if (!id) return;
    const s = STOCKS.find(x => x.id === id)!;
    try {
      const res = await fetch(`/api/stock/chart?ticker=${encodeURIComponent(s.ticker)}&range=${p}`);
      const data = await res.json();
      if (!data.error) setCompareOhlc(data.quotes);
    } catch {}
  }, []);

  useEffect(() => { fetchPrices(); }, [fetchPrices]);
  useEffect(() => { fetchChart(selectedId, period); setCompareOhlc([]); }, [selectedId, period, fetchChart]);
  useEffect(() => { if (compareId) fetchCompareChart(compareId, period); }, [compareId, period, fetchCompareChart]);
  useEffect(() => { if (tab === 'forecast' || tab === 'news') fetchForecast(selectedId); }, [selectedId, tab, fetchForecast]);

  // Render charts after ohlc loads
  useEffect(() => {
    if (!chartReady || !ohlc.length || loading) return;
    if (tab !== 'chart') return;
    setTimeout(() => renderCharts(), 80);
  }, [chartReady, ohlc, tab, loading, selected]);

  function renderCharts() {
    if (!ohlc.length || !window.Chart) return;
    const labels = ohlc.map(d => {
      const dt = new Date(d.date);
      return (dt.getMonth()+1)+'/'+ dt.getDate();
    });
    const pred = predictPrices(ohlc);

    if (tab === 'chart') {
      const sma20 = calcSMA(ohlc, 20);
      const sma50 = calcSMA(ohlc, Math.min(50,ohlc.length));
      const bb = calcBB(ohlc);
      const { macd, sig, hist } = calcMACD(ohlc);
      const rsiArr = calcRSI(ohlc);

      // Normalize compare data to percentage base if compare mode
      const compareDatasets = compareOhlc.length > 0 ? (() => {
        const compS = STOCKS.find(x => x.id === compareId);
        if (!compS) return [];
        // Find overlap dates and normalize both to 100 at start
        const mainBase = ohlc[0]?.close ?? 1;
        const normMain = ohlc.map(d => d.close ? (d.close / mainBase - 1) * 100 : null);
        const compDates = new Set(compareOhlc.map(d => d.date));
        const compMap = Object.fromEntries(compareOhlc.map(d => [d.date, d.close]));
        const compBase = compareOhlc[0]?.close ?? 1;
        const normComp = ohlc.map(d => compMap[d.date] ? ((compMap[d.date]! / compBase) - 1) * 100 : null);
        return [
          { label:`${selected.name} (%)`, data:normMain, borderColor:selected.color, borderWidth:2, pointRadius:0, fill:false },
          { label:`${compS.name} (%)`, data:normComp, borderColor:compS.color, borderWidth:2, borderDash:[5,3], pointRadius:0, fill:false },
        ];
      })() : null;

      destroyChart('priceChart');
      new window.Chart(document.getElementById('priceChart'), {
        type:'line',
        data:{ labels, datasets: compareDatasets ?? [
          { label:'終値', data:ohlc.map(d=>d.close), borderColor:selected.color, borderWidth:2, pointRadius:0, tension:0.3, fill:false },
          { label:'SMA20', data:sma20, borderColor:'#f59e0b', borderWidth:1.5, pointRadius:0, tension:0, fill:false, borderDash:[4,2] },
          { label:'SMA50', data:sma50, borderColor:'#8b5cf6', borderWidth:1.5, pointRadius:0, tension:0, fill:false, borderDash:[4,2] },
          { label:'BB上限', data:bb.map(b=>b.upper), borderColor:'rgba(148,163,184,0.35)', borderWidth:1, pointRadius:0, fill:false, borderDash:[2,3] },
          { label:'BB下限', data:bb.map(b=>b.lower), borderColor:'rgba(148,163,184,0.35)', borderWidth:1, pointRadius:0, fill:'+1', backgroundColor:'rgba(148,163,184,0.04)', borderDash:[2,3] },
        ]},
        options: CHART_OPTS(compareDatasets ? '騰落率(%)' : cur==='JPY'?'¥':'$'),
      });

      destroyChart('rsiChart');
      new window.Chart(document.getElementById('rsiChart'), {
        type:'line',
        data:{ labels, datasets:[{ label:'RSI', data:rsiArr, borderColor:'#06b6d4', borderWidth:1.5, pointRadius:0, fill:false, tension:0.2 }]},
        options: CHART_OPTS(undefined, 0, 100),
      });

      destroyChart('macdChart');
      new window.Chart(document.getElementById('macdChart'), {
        type:'bar',
        data:{ labels, datasets:[
          { label:'ヒスト', data:hist, backgroundColor:hist.map(v=>v>=0?'rgba(16,185,129,0.5)':'rgba(239,68,68,0.5)'), borderWidth:0, order:2 },
          { label:'MACD', data:macd, type:'line', borderColor:'#3b82f6', borderWidth:1.5, pointRadius:0, fill:false, order:1 },
          { label:'シグナル', data:sig, type:'line', borderColor:'#f59e0b', borderWidth:1, pointRadius:0, fill:false, order:0 },
        ]},
        options: CHART_OPTS(),
      });

      destroyChart('volChart');
      new window.Chart(document.getElementById('volChart'), {
        type:'bar',
        data:{ labels, datasets:[{ label:'出来高', data:ohlc.map(d=>d.volume), backgroundColor:ohlc.map((d,i)=>i>0&&d.close>=ohlc[i-1].close?'rgba(16,185,129,0.6)':'rgba(239,68,68,0.6)'), borderWidth:0 }]},
        options: CHART_OPTS(),
      });
    }

  }

  // Derived indicators
  const rsiArr = ohlc.length ? calcRSI(ohlc) : [];
  const lastRSI = rsiArr.filter(v=>v!=null).at(-1) ?? 50;
  const { macd, sig } = ohlc.length ? calcMACD(ohlc) : { macd:[0], sig:[0] };
  const lastMACD = macd.at(-1) ?? 0, lastSig = sig.at(-1) ?? 0;
  const bb = ohlc.length ? calcBB(ohlc) : [];
  const lastBB = bb.at(-1) ?? { upper:0, mid:0, lower:0 };
  const lastClose = ohlc.at(-1)?.close ?? 0;
  const bbPos = lastBB.upper && lastBB.lower ? (lastClose - lastBB.lower!) / (lastBB.upper! - lastBB.lower!) * 100 : 50;
  const sma20last = calcSMA(ohlc,20).filter(v=>v!=null).at(-1) ?? 0;
  const pred = ohlc.length ? predictPrices(ohlc) : null;

  let bullPts = 0;
  if (pred?.trend==='UP') bullPts+=2;
  if (lastRSI<50) bullPts+=1;
  if (lastMACD>lastSig) bullPts+=2;
  if (lastClose>sma20last) bullPts+=1;
  const sigPct = Math.min(95, Math.max(5, bullPts/6*100));
  const sigLabel = sigPct>65?'買い':sigPct<35?'売り':'中立';
  const sigColor = sigPct>65?'#10b981':sigPct<35?'#ef4444':'#f59e0b';

  const pData = prices[selectedId];
  const displayPrice = pData?.price ?? lastClose;
  const displayChg = pData?.changePct;
  const hi52 = pData?.high52 ?? Math.max(...ohlc.map(d=>d.high));
  const lo52 = pData?.low52 ?? Math.min(...ohlc.map(d=>d.low));

  const events = (EVENTS[selectedId] || []).filter(e => new Date(e.date) >= new Date()).slice(0,5);
  const ana = ANALYSIS[selectedId] ?? {};

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-200 font-sans">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-[#0f172a] to-[#1e3a5f] border-b border-[#1e3a5f] px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-cyan-400">📊 半導体・電線株 分析システム</h1>
          <div className="text-xs text-slate-400">Semiconductor &amp; Wire/Cable Stocks — Real-time Analysis</div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && <span className="text-xs text-slate-500">更新: {lastUpdate}</span>}
          <button
            onClick={() => { fetchPrices(); fetchChart(selectedId, period); }}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >↻ 更新</button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-65px)]">
        {/* Sidebar */}
        <div className="w-[270px] shrink-0 bg-[#111827] border-r border-[#1e3a5f] overflow-y-auto p-2">
          {(['US','JP'] as const).map(mkt => (
            <div key={mkt}>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 py-2 mt-1">{mkt === 'US' ? '米国株' : '日本株'}</div>
              {STOCKS.filter(s=>s.market===mkt).map(s => {
                const pd = prices[s.id];
                const isJP = s.market==='JP';
                return (
                  <div
                    key={s.id}
                    onClick={() => { setSelectedId(s.id); setForecast(null); if (tab === 'news') setTab('chart'); }}
                    className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all border ${
                      selectedId===s.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-transparent hover:border-[#1e3a5f] hover:bg-[#1a2332]'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0"
                      style={{background:`${s.color}22`, color:s.color}}>
                      {s.ticker.replace('.T','').slice(0,4)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[13px] font-semibold truncate">{s.name}</span>
                        <button
                          onClick={e => { e.stopPropagation(); toggleWatchlist(s.id); }}
                          className={`text-[12px] shrink-0 transition-colors ${watchlist.has(s.id) ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'}`}
                        >★</button>
                      </div>
                      <div className="text-[10px] text-slate-400">{s.ticker}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-[12px] font-bold ${pctCls(pd?.changePct)}`}>
                        {pd?.price ? fmtPrice(pd.price, isJP?'JPY':'USD') : '—'}
                      </div>
                      <div className={`text-[10px] font-semibold ${pctCls(pd?.changePct)}`}>
                        {fmtPct(pd?.changePct)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Main */}
        <div className="flex-1 overflow-y-auto bg-[#0a0e1a] p-5">
          {/* Stock Header */}
          <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-sm font-black"
                style={{background:`${selected.color}22`,color:selected.color}}>
                {selected.ticker.replace('.T','').slice(0,4)}
              </div>
              <div>
                <h2 className="text-2xl font-extrabold">{selected.name}</h2>
                <div className="text-sm text-slate-400 mt-0.5">{selected.en} · {selected.ticker} · {selected.sector}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-extrabold ${pctCls(displayChg)}`}>{fp(displayPrice)}</div>
              <div className={`text-base font-bold mt-1 ${pctCls(displayChg)}`}>
                {fmtPrice(pData?.change, cur)} ({fmtPct(displayChg)})
              </div>
            </div>
          </div>

          {error && <div className="bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl p-4 text-sm mb-4">⚠ {error}</div>}

          {/* Score cards */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
            {[
              { label:'総合シグナル', val:sigLabel, sub:`${sigPct.toFixed(0)}% 強気`, color:sigColor },
              { label:'RSI (14)', val:lastRSI.toFixed(1), sub:lastRSI>70?'買われ過ぎ':lastRSI<30?'売られ過ぎ':'中立域', color:lastRSI>70?'#ef4444':lastRSI<30?'#10b981':'#94a3b8' },
              { label:'BB位置', val:`${bbPos.toFixed(0)}%`, sub:bbPos>80?'上限付近':bbPos<20?'下限付近':'中央付近', color:'#94a3b8' },
              { label:'MACDシグナル', val:lastMACD>lastSig?'ゴールデン':'デッドクロス', sub:lastMACD.toFixed(3), color:lastMACD>lastSig?'#10b981':'#ef4444' },
              { label:'52週高値', val:fp(hi52), sub:`現在値${hi52?((lastClose/hi52-1)*100).toFixed(1)+'%':'—'}`, color:'#94a3b8' },
              { label:'52週安値', val:fp(lo52), sub:`現在値+${lo52?((lastClose/lo52-1)*100).toFixed(1)+'%':'—'}`, color:'#94a3b8' },
            ].map(c => (
              <div key={c.label} className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-3.5">
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1.5">{c.label}</div>
                <div className="text-lg font-extrabold" style={{color:c.color}}>{c.val}</div>
                <div className="text-[10px] text-slate-500 mt-1">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-5 bg-[#111827] border border-[#1e3a5f] rounded-xl p-1 flex-wrap">
            {(['chart','forecast','events','news','analysis'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab===t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a2332]'
                }`}>
                {t==='chart'?'📈 チャート':t==='forecast'?'🎯 シナリオ分析':t==='events'?'📅 イベント':t==='news'?'📰 ニュース':'🔍 分析'}
              </button>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center h-48 flex-col gap-3">
              <div className="w-10 h-10 border-2 border-[#1e3a5f] border-t-blue-500 rounded-full animate-spin"/>
              <div className="text-sm text-slate-400 animate-pulse">{selected.name} のデータを取得中...</div>
            </div>
          )}

          {/* Chart Tab */}
          {!loading && tab === 'chart' && (
            <div>
              <div className="flex gap-2 mb-3 flex-wrap items-center">
                {['1mo','3mo','6mo','1y','2y'].map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      period===p ? 'bg-blue-600 text-white border-blue-600' : 'border-[#1e3a5f] text-slate-400 hover:border-blue-500 hover:text-slate-200'
                    }`}>{p}</button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">比較:</span>
                  <select
                    value={compareId ?? ''}
                    onChange={e => setCompareId(e.target.value || null)}
                    className="bg-[#111827] border border-[#1e3a5f] text-slate-300 text-xs rounded-lg px-2 py-1.5"
                  >
                    <option value="">なし</option>
                    {STOCKS.filter(s => s.id !== selectedId).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bg-[#111827] border border-[#1e3a5f] rounded-2xl p-5 mb-3">
                <div className="text-xs font-bold text-slate-400 mb-3">株価チャート + BB + SMA20/50</div>
                <canvas id="priceChart" style={{maxHeight:'320px'}}/>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {id:'rsiChart', label:'RSI (14)'},
                  {id:'macdChart', label:'MACD'},
                  {id:'volChart', label:'出来高'},
                ].map(c => (
                  <div key={c.id} className="bg-[#111827] border border-[#1e3a5f] rounded-2xl p-4">
                    <div className="text-xs font-bold text-slate-400 mb-2">{c.label}</div>
                    <canvas id={c.id} style={{maxHeight:'140px'}}/>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Forecast Tab */}
          {tab === 'forecast' && (
            <div>
              {forecastLoading && (
                <div className="flex items-center justify-center h-48 flex-col gap-3">
                  <div className="w-10 h-10 border-2 border-[#1e3a5f] border-t-blue-500 rounded-full animate-spin"/>
                  <div className="text-sm text-slate-400 animate-pulse">シナリオ分析を計算中...</div>
                </div>
              )}
              {forecastError && !forecastLoading && (
                <div className="bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl p-4 text-sm mb-4">⚠ {forecastError}</div>
              )}
              {forecast && !forecastLoading && (() => {
                const { categoryScores: cs, forecast: fc, backtest: bt, dataQuality: dq } = forecast;
                const dirColor = (d: string) => d.includes('strong_bull') ? '#10b981' : d.includes('bull') ? '#34d399' : d.includes('bear') && d.includes('strong') ? '#ef4444' : d.includes('bear') ? '#f87171' : '#94a3b8';
                const dirLabel = (d: string) => ({ strong_bullish:'強い強気 ▲▲', bullish:'強気 ▲', slightly_bullish:'やや強気 △', neutral:'中立 ─', slightly_bearish:'やや弱気 ▽', bearish:'弱気 ▼', strong_bearish:'強い弱気 ▼▼' }[d] ?? d);
                const confBar = (c: number) => (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex-1 h-1.5 bg-[#1e3a5f] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{width:`${c*100}%`}}/>
                    </div>
                    <span className="text-[10px] text-slate-500">{(c*100).toFixed(0)}%</span>
                  </div>
                );
                const fmtRange = (r: ForecastRange) => {
                  const fmt = (v: number) => cur === 'JPY' ? '¥'+Math.round(v).toLocaleString() : '$'+v.toFixed(2);
                  return { down: fmt(r.downside), base: fmt(r.base), up: fmt(r.upside) };
                };
                return (
                  <div className="flex flex-col gap-4">
                    {/* Data quality */}
                    {dq.missingFields.length > 0 && (
                      <div className="bg-yellow-500/8 border border-yellow-500/25 rounded-xl p-3 text-xs text-yellow-400">
                        ⚠ データ品質スコア: {dq.score}/100 — 不足: {dq.missingFields.join(', ')}
                      </div>
                    )}

                    {/* 3-horizon grid */}
                    <div className="grid grid-cols-3 gap-3">
                      {([fc.shortTerm, fc.mediumTerm, fc.longTerm] as HorizonForecast[]).map((h, i) => {
                        const r = fmtRange(h.expectedRange);
                        return (
                          <div key={h.horizon} className="bg-[#111827] border border-[#1e3a5f] rounded-2xl p-4">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                              {i===0?'短期 (1週〜1ヶ月)':i===1?'中期 (1〜3ヶ月)':'長期 (3〜12ヶ月)'}
                            </div>
                            <div className="text-2xl font-extrabold mb-0.5" style={{color:dirColor(h.direction)}}>
                              {dirLabel(h.direction)}
                            </div>
                            <div className="text-[11px] text-slate-400 mb-2">スコア: {h.score}/100</div>
                            <div className="text-[10px] text-slate-500 mb-1">信頼度</div>
                            {confBar(h.confidence)}
                            <div className="mt-3 border-t border-[#1e3a5f] pt-3 grid grid-cols-3 gap-0 text-center text-[10px]">
                              <div>
                                <div className="text-red-400 font-bold mb-0.5">弱気</div>
                                <div className="text-slate-300 font-semibold">{r.down}</div>
                              </div>
                              <div className="border-x border-[#1e3a5f]">
                                <div className="text-slate-400 font-bold mb-0.5">標準</div>
                                <div className="text-slate-200 font-bold">{r.base}</div>
                              </div>
                              <div>
                                <div className="text-emerald-400 font-bold mb-0.5">強気</div>
                                <div className="text-slate-300 font-semibold">{r.up}</div>
                              </div>
                            </div>
                            {h.warnings.length > 0 && (
                              <div className="mt-2 text-[10px] text-yellow-400">{h.warnings[0]}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Score breakdown */}
                    <div className="bg-[#111827] border border-[#1e3a5f] rounded-2xl p-4">
                      <div className="text-xs font-bold text-slate-400 uppercase mb-3">スコア内訳（6カテゴリ）</div>
                      <div className="grid grid-cols-6 gap-2">
                        {([
                          { key:'テクニカル', cat: cs.technical },
                          { key:'テーマ', cat: cs.theme },
                          { key:'マクロ', cat: cs.macro },
                          { key:'イベント', cat: cs.event },
                          { key:'ファンダ', cat: cs.fundamental },
                          { key:'ニュース', cat: cs.news },
                        ]).map(({ key, cat }) => (
                          <div key={key} className="text-center">
                            <div className="text-[10px] text-slate-500 mb-1">{key}</div>
                            <div className="text-lg font-extrabold" style={{color: cat.score>=65?'#10b981':cat.score>=45?'#94a3b8':'#ef4444'}}>{cat.score}</div>
                            {confBar(cat.confidence)}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Macro display */}
                    {forecast.macroDisplay && (() => {
                      const m = forecast.macroDisplay!;
                      const pctStr = (v?: number) => v == null ? '—' : `${v>=0?'+':''}${v.toFixed(1)}%`;
                      const clsV = (v?: number) => v == null ? 'text-slate-400' : v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-slate-400';
                      return (
                        <div className="bg-[#111827] border border-[#1e3a5f] rounded-2xl p-4">
                          <div className="text-xs font-bold text-slate-400 uppercase mb-3">マクロ指標（自動取得）</div>
                          <div className="grid grid-cols-5 gap-3">
                            {[
                              { label:'VIX', val: m.vix?.toFixed(1) ?? '—', sub: `1日: ${pctStr(m.vixChange)}`, cls: m.vix && m.vix > 25 ? 'text-red-400' : m.vix && m.vix < 18 ? 'text-emerald-400' : 'text-slate-200' },
                              { label:'SOX 1ヶ月', val: pctStr(m.soxChange1m), sub:'フィラデルフィア半導体指数', cls: clsV(m.soxChange1m) },
                              { label:'S&P500 1ヶ月', val: pctStr(m.sp500Change1m), sub:'米国株市場', cls: clsV(m.sp500Change1m) },
                              { label:'USD/JPY', val: m.usdjpy?.toFixed(1) ?? '—', sub: `1ヶ月: ${pctStr(m.usdjpyChange)}`, cls: 'text-slate-200' },
                              { label:'米10年金利', val: m.tnx ? `${m.tnx.toFixed(2)}%` : '—', sub: `1日変化: ${pctStr(m.tnxChange)}`, cls: m.tnx && m.tnx > 4.5 ? 'text-red-400' : m.tnx && m.tnx < 4.0 ? 'text-emerald-400' : 'text-slate-200' },
                            ].map(item => (
                              <div key={item.label} className="bg-[#0a0e1a] rounded-xl p-3 text-center">
                                <div className="text-[10px] text-slate-500 mb-1">{item.label}</div>
                                <div className={`text-base font-extrabold ${item.cls}`}>{item.val}</div>
                                <div className="text-[9px] text-slate-600 mt-0.5">{item.sub}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Fundamental display */}
                    {forecast.fundamentalDisplay && Object.keys(forecast.fundamentalDisplay).length > 0 && (() => {
                      const f = forecast.fundamentalDisplay!;
                      const fmtMktCap = (v?: number) => {
                        if (!v) return '—';
                        return cur === 'JPY'
                          ? v >= 1e12 ? `¥${(v/1e12).toFixed(1)}兆` : `¥${(v/1e8).toFixed(0)}億`
                          : v >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : `$${(v/1e6).toFixed(0)}M`;
                      };
                      const fmtPct2 = (v?: number) => v == null ? '—' : `${(v*100).toFixed(1)}%`;
                      const fmtNum = (v?: number, d=2) => v == null ? '—' : v.toFixed(d);
                      return (
                        <div className="bg-[#111827] border border-[#1e3a5f] rounded-2xl p-4">
                          <div className="text-xs font-bold text-slate-400 uppercase mb-3">ファンダメンタルデータ（Yahoo Finance自動取得）</div>
                          <div className="grid grid-cols-4 lg:grid-cols-7 gap-2">
                            {[
                              { label:'時価総額', val: fmtMktCap(f.marketCap) },
                              { label:'予想PER', val: fmtNum(f.forwardPE) },
                              { label:'実績PER', val: fmtNum(f.trailingPE) },
                              { label:'PBR', val: fmtNum(f.priceToBook) },
                              { label:'PEGレシオ', val: fmtNum(f.pegRatio) },
                              { label:'EPS', val: f.eps != null ? (cur==='JPY'?'¥':'$')+f.eps.toFixed(2) : '—' },
                              { label:'ベータ', val: fmtNum(f.beta) },
                              { label:'売上成長率', val: fmtPct2(f.revenueGrowth) },
                              { label:'粗利率', val: fmtPct2(f.grossMargin) },
                              { label:'営業利益率', val: fmtPct2(f.operatingMargin) },
                              { label:'ROE', val: fmtPct2(f.returnOnEquity) },
                              { label:'D/Eレシオ', val: fmtNum(f.debtToEquity, 0) },
                              { label:'配当利回り', val: fmtPct2(f.dividendYield) },
                            ].map(item => (
                              <div key={item.label} className="bg-[#0a0e1a] rounded-lg p-2 text-center">
                                <div className="text-[9px] text-slate-500 mb-0.5">{item.label}</div>
                                <div className="text-xs font-bold text-slate-200">{item.val}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Short-term factors */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#111827] border border-[#1e3a5f] rounded-2xl p-4">
                        <div className="text-xs font-bold text-emerald-500 mb-3">✚ プラス材料（短期）</div>
                        {fc.shortTerm.positiveFactors.length === 0
                          ? <div className="text-slate-500 text-xs">なし</div>
                          : fc.shortTerm.positiveFactors.map((f, i) => (
                            <div key={i} className="mb-2 last:mb-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-200">{f.name}</span>
                                <span className="text-xs font-bold text-emerald-400">+{f.score}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{f.reason}</div>
                            </div>
                          ))
                        }
                      </div>
                      <div className="bg-[#111827] border border-[#1e3a5f] rounded-2xl p-4">
                        <div className="text-xs font-bold text-red-500 mb-3">✖ マイナス材料（短期）</div>
                        {fc.shortTerm.negativeFactors.length === 0
                          ? <div className="text-slate-500 text-xs">なし</div>
                          : fc.shortTerm.negativeFactors.map((f, i) => (
                            <div key={i} className="mb-2 last:mb-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-200">{f.name}</span>
                                <span className="text-xs font-bold text-red-400">{f.score}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{f.reason}</div>
                            </div>
                          ))
                        }
                      </div>
                    </div>

                    {/* Backtest */}
                    <div className="bg-[#111827] border border-[#1e3a5f] rounded-2xl p-4">
                      <div className="text-xs font-bold text-slate-400 uppercase mb-3">バックテスト結果 <span className="text-[10px] font-normal normal-case">（過去シグナルの参考値）</span></div>
                      {!bt.verified
                        ? <div className="text-xs text-yellow-400">{bt.note ?? 'データ不足のためバックテスト未実施'}</div>
                        : (
                          <div>
                            <div className="text-[10px] text-slate-500 mb-2">期間: {bt.period} / サンプル数: {bt.sampleSize}件</div>
                            {bt.oneMonth && (
                              <div className="grid grid-cols-4 gap-2 mb-3">
                                {[
                                  { l:'勝率', v:`${bt.oneMonth.winRate}%` },
                                  { l:'平均リターン', v:`${bt.oneMonth.avgReturn>0?'+':''}${bt.oneMonth.avgReturn}%` },
                                  { l:'中央値', v:`${bt.oneMonth.medianReturn>0?'+':''}${bt.oneMonth.medianReturn}%` },
                                  { l:'最大DD', v:`-${bt.oneMonth.maxDrawdown}%` },
                                ].map(({ l, v }) => (
                                  <div key={l} className="bg-[#0a0e1a] rounded-xl p-2.5 text-center">
                                    <div className="text-[10px] text-slate-500 mb-1">{l}</div>
                                    <div className="text-sm font-bold text-slate-200">{v}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex flex-col gap-1.5">
                              {bt.signalPerformance.map((sp, i) => (
                                <div key={i} className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400">{sp.signal} ({sp.count}件)</span>
                                  <span className="text-slate-300">勝率 <b>{sp.winRate1m}%</b> / 平均 <b>{sp.avgReturn1m>0?'+':''}{sp.avgReturn1m}%</b></span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      }
                    </div>

                    {/* Disclaimer */}
                    <div className="bg-yellow-500/6 border border-yellow-500/20 rounded-xl p-4 text-[11px] text-yellow-400 leading-relaxed">
                      ⚠ 免責事項: 本シナリオ分析はテクニカル指標・テーマ評価・イベント分析・マクロ環境を組み合わせた参考情報であり、将来の株価を保証するものではありません。
                      実際の株価は市場環境・決算・地政学リスク等により大幅に乖離する場合があります。投資判断は自己責任でお願いします。
                      「想定レンジ」は過去ボラティリティをもとにした統計的範囲であり、価格目標ではありません。
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Events Tab */}
          {!loading && tab === 'events' && (
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">今後のイベントカレンダー</div>
              {events.length === 0
                ? <div className="text-slate-500 text-sm p-4">登録イベントなし</div>
                : <div className="flex flex-col gap-2.5">
                    {events.map((e,i) => (
                      <div key={i} className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{background:e.color}}/>
                        <div className="text-sm font-bold text-slate-400 w-28 shrink-0">{e.date}</div>
                        <div>
                          <div className="text-sm font-bold" style={{color:e.color}}>{e.type}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{e.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          )}

          {/* News Tab */}
          {tab === 'news' && (
            <div>
              {forecastLoading && (
                <div className="flex items-center justify-center h-32 gap-3">
                  <div className="w-7 h-7 border-2 border-[#1e3a5f] border-t-blue-500 rounded-full animate-spin"/>
                  <span className="text-sm text-slate-400">ニュースを取得中...</span>
                </div>
              )}
              {!forecastLoading && forecast?.newsItems && (() => {
                const items = forecast.newsItems!;
                const sentColor = (s: string) => s === 'positive' ? '#10b981' : s === 'negative' ? '#ef4444' : '#94a3b8';
                const sentLabel = (s: string) => s === 'positive' ? '↑ポジティブ' : s === 'negative' ? '↓ネガティブ' : '─中立';
                const posCount = items.filter(n => n.sentiment === 'positive').length;
                const negCount = items.filter(n => n.sentiment === 'negative').length;
                return (
                  <div className="flex flex-col gap-3">
                    {/* Sentiment summary */}
                    <div className="bg-[#111827] border border-[#1e3a5f] rounded-2xl p-4 flex items-center gap-6">
                      <div className="text-xs text-slate-400">ニュースセンチメント ({items.length}件)</div>
                      <div className="flex gap-4">
                        <span className="text-emerald-400 font-bold text-sm">↑ {posCount}件</span>
                        <span className="text-red-400 font-bold text-sm">↓ {negCount}件</span>
                        <span className="text-slate-400 font-bold text-sm">─ {items.length - posCount - negCount}件</span>
                      </div>
                      <div className="flex-1 h-2 bg-[#1e3a5f] rounded-full overflow-hidden ml-2">
                        <div className="h-full rounded-full bg-emerald-500" style={{width:`${items.length?posCount/items.length*100:50}%`}}/>
                      </div>
                    </div>
                    {/* News list */}
                    {items.map((n, i) => {
                      const age = Math.floor((Date.now() - new Date(n.publishedAt).getTime()) / 3600000);
                      const ageStr = age < 24 ? `${age}時間前` : `${Math.floor(age/24)}日前`;
                      return (
                        <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
                          className="bg-[#111827] border border-[#1e3a5f] hover:border-blue-500/50 rounded-xl p-4 flex items-start gap-3 transition-all cursor-pointer group">
                          <div className="w-1.5 h-full min-h-[2.5rem] rounded-full shrink-0 mt-1" style={{background:sentColor(n.sentiment)}}/>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-200 group-hover:text-blue-300 leading-snug">{n.title}</div>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-[10px]" style={{color:sentColor(n.sentiment)}}>{sentLabel(n.sentiment)}</span>
                              <span className="text-[10px] text-slate-500">{n.publisher}</span>
                              <span className="text-[10px] text-slate-600">{ageStr}</span>
                            </div>
                          </div>
                          <span className="text-slate-600 group-hover:text-blue-400 shrink-0 mt-1">↗</span>
                        </a>
                      );
                    })}
                    {items.length === 0 && <div className="text-slate-500 text-sm p-4">ニュースデータが取得できませんでした</div>}
                    <div className="text-[10px] text-slate-600 pt-2">センチメント判定はキーワードベースの自動分析です。内容を確認の上ご利用ください。</div>
                  </div>
                );
              })()}
              {!forecastLoading && !forecast?.newsItems && !forecastError && (
                <div className="text-slate-500 text-sm p-4">ニュースを読み込めませんでした</div>
              )}
            </div>
          )}

          {/* Analysis Tab */}
          {!loading && tab === 'analysis' && (
            <div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
                  <div className="text-xs font-bold text-slate-500 uppercase mb-3">🟢 強気シナリオ</div>
                  <div className="text-sm text-slate-200 leading-relaxed">{ana.bull || '—'}</div>
                </div>
                <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
                  <div className="text-xs font-bold text-slate-500 uppercase mb-3">🔴 リスク・弱気シナリオ</div>
                  <div className="text-sm text-slate-200 leading-relaxed">{ana.bear || '—'}</div>
                </div>
              </div>
              <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4 mb-3">
                <div className="text-xs font-bold text-slate-500 uppercase mb-3">📌 投資テーゼ</div>
                <div className="text-sm text-slate-200 leading-relaxed">{ana.thesis || '—'}</div>
              </div>
              <div className="bg-[#111827] border border-[#1e3a5f] rounded-xl p-4">
                <div className="text-xs font-bold text-slate-500 uppercase mb-3">テクニカル サポート・レジスタンス</div>
                <div className="flex flex-col gap-2">
                  {[
                    { label:'現在値',       val: lastClose, note:'' },
                    { label:'SMA20',       val: sma20last, note: lastClose>sma20last?'↑ 上':'↓ 下' },
                    { label:'BB上限 (2σ)', val: lastBB.upper, note:'レジスタンス' },
                    { label:'BB中心',      val: lastBB.mid,   note:'ミッド' },
                    { label:'BB下限 (2σ)', val: lastBB.lower, note:'サポート' },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-sm">
                      <span className="text-slate-400">{r.label}</span>
                      <span className="font-bold">{fp(r.val)} <span className="text-[10px] text-slate-500">{r.note}</span></span>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <div className="text-[10px] text-slate-500 mb-2">総合シグナル強度</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-red-400">売</span>
                    <div className="flex-1 h-2 rounded-full relative" style={{background:'linear-gradient(to right,#ef4444,#f59e0b,#10b981)'}}>
                      <div className="absolute w-3 h-3 bg-white rounded-full border-2 border-[#0a0e1a] top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all" style={{left:`${sigPct}%`}}/>
                    </div>
                    <span className="text-[10px] text-emerald-400">買</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-600 mt-1 px-1">
                    <span>強売</span><span>売</span><span>中立</span><span>買</span><span>強買</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
