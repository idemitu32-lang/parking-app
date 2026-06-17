'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

// ============================================================
// Types
// ============================================================
interface OHLC { date: string; open: number; high: number; low: number; close: number; volume: number; }
interface StockDef { id: string; name: string; en: string; ticker: string; market: 'US'|'JP'; color: string; sector: string; }
interface PriceData { price: number; changePct: number; change: number; high52: number; low52: number; currency: string; error?: string; }

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
  const [tab, setTab] = useState<'chart'|'predict'|'events'|'analysis'>('chart');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState('');
  const chartMounted = useRef(false);

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

  useEffect(() => { fetchPrices(); }, [fetchPrices]);
  useEffect(() => { fetchChart(selectedId, period); }, [selectedId, period, fetchChart]);

  // Render charts after ohlc loads
  useEffect(() => {
    if (!chartReady || !ohlc.length || loading) return;
    if (tab !== 'chart' && tab !== 'predict') return;
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

      destroyChart('priceChart');
      new window.Chart(document.getElementById('priceChart'), {
        type:'line',
        data:{ labels, datasets:[
          { label:'終値', data:ohlc.map(d=>d.close), borderColor:selected.color, borderWidth:2, pointRadius:0, tension:0.3, fill:false },
          { label:'SMA20', data:sma20, borderColor:'#f59e0b', borderWidth:1.5, pointRadius:0, tension:0, fill:false, borderDash:[4,2] },
          { label:'SMA50', data:sma50, borderColor:'#8b5cf6', borderWidth:1.5, pointRadius:0, tension:0, fill:false, borderDash:[4,2] },
          { label:'BB上限', data:bb.map(b=>b.upper), borderColor:'rgba(148,163,184,0.35)', borderWidth:1, pointRadius:0, fill:false, borderDash:[2,3] },
          { label:'BB下限', data:bb.map(b=>b.lower), borderColor:'rgba(148,163,184,0.35)', borderWidth:1, pointRadius:0, fill:'+1', backgroundColor:'rgba(148,163,184,0.04)', borderDash:[2,3] },
        ]},
        options: CHART_OPTS(cur==='JPY'?'¥':'$'),
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

    if (tab === 'predict') {
      const last = ohlc[ohlc.length-1].close;
      const futureLabels = ['1ヶ月後','3ヶ月後','6ヶ月後'];
      const futurePrices = [pred['1mo'].price, pred['3mo'].price, pred['6mo'].price];
      const allLabels = [...labels, ...futureLabels];
      const histData = [...ohlc.map(d=>d.close), null, null, null];
      const predData = [...Array(ohlc.length-1).fill(null), last, ...futurePrices];
      const bullData = [...Array(ohlc.length-1).fill(null), last, ...futurePrices.map(v=>v*1.07)];
      const bearData = [...Array(ohlc.length-1).fill(null), last, ...futurePrices.map(v=>v*0.93)];

      destroyChart('predictChart');
      new window.Chart(document.getElementById('predictChart'), {
        type:'line',
        data:{ labels:allLabels, datasets:[
          { label:'実績', data:histData, borderColor:selected.color, borderWidth:2, pointRadius:0, fill:false },
          { label:'予測(中央)', data:predData, borderColor:'#8b5cf6', borderWidth:2, borderDash:[6,3], pointRadius:[...Array(ohlc.length-1).fill(0),4,4,4,4], fill:false },
          { label:'強気+7%', data:bullData, borderColor:'rgba(16,185,129,0.4)', borderWidth:1, borderDash:[2,4], pointRadius:0, fill:'-1', backgroundColor:'rgba(16,185,129,0.06)' },
          { label:'弱気-7%', data:bearData, borderColor:'rgba(239,68,68,0.4)', borderWidth:1, borderDash:[2,4], pointRadius:0, fill:'+1', backgroundColor:'rgba(239,68,68,0.06)' },
        ]},
        options: CHART_OPTS(cur==='JPY'?'¥':'$'),
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

  const fmtPredItem = (key: '1mo'|'3mo'|'6mo') => {
    if (!pred) return { priceFmt:'—', pct:'—', cls:'text-slate-400', conf:'—' };
    const p = pred[key].price;
    const pct = (p - lastClose) / lastClose * 100;
    return { priceFmt: fp(p), pct: fmtPct(pct), cls: pctCls(pct), conf: pred[key].conf+'' };
  };

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
                    onClick={() => { setSelectedId(s.id); setTab('chart'); }}
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
                      <div className="text-[13px] font-semibold truncate">{s.name}</div>
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
          <div className="flex gap-1 mb-5 bg-[#111827] border border-[#1e3a5f] rounded-xl p-1 w-fit">
            {(['chart','predict','events','analysis'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab===t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a2332]'
                }`}>
                {t==='chart'?'📈 チャート':t==='predict'?'🎯 予測':t==='events'?'📅 イベント':'🔍 分析'}
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
              <div className="flex gap-2 mb-3 flex-wrap">
                {['1mo','3mo','6mo','1y','2y'].map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      period===p ? 'bg-blue-600 text-white border-blue-600' : 'border-[#1e3a5f] text-slate-400 hover:border-blue-500 hover:text-slate-200'
                    }`}>{p}</button>
                ))}
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

          {/* Predict Tab */}
          {!loading && tab === 'predict' && (
            <div>
              <div className="bg-gradient-to-br from-blue-500/8 to-purple-500/8 border border-blue-500/30 rounded-2xl p-5 mb-4">
                <div className="text-sm font-bold text-cyan-400 mb-4">🤖 AI価格予測 (テクニカル分析ベース)</div>
                <div className="grid grid-cols-3 gap-0 divide-x divide-[#1e3a5f]">
                  {(['1mo','3mo','6mo'] as const).map((k,i) => {
                    const p = fmtPredItem(k);
                    return (
                      <div key={k} className="text-center px-4 py-2">
                        <div className="text-xs text-slate-400 font-semibold mb-2">
                          {k==='1mo'?'1ヶ月後':k==='3mo'?'3ヶ月後':'6ヶ月後'}
                        </div>
                        <div className={`text-xl font-extrabold ${p.cls}`}>{p.priceFmt}</div>
                        <div className={`text-sm font-bold mt-1 ${p.cls}`}>{p.pct}</div>
                        <div className="text-[10px] text-slate-500 mt-1.5">信頼度 {p.conf}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-[#111827] border border-[#1e3a5f] rounded-2xl p-5 mb-4">
                <div className="text-xs font-bold text-slate-400 mb-3">予測チャート (実績 + 強気/弱気レンジ)</div>
                <canvas id="predictChart" style={{maxHeight:'320px'}}/>
              </div>
              <div className="bg-yellow-500/8 border border-yellow-500/25 rounded-xl p-4 text-xs text-yellow-400">
                ⚠ 免責事項: この予測は線形回帰・RSI・MACD・ボリンジャーバンドを組み合わせたテクニカル分析に基づきます。
                実際の株価は市場環境・決算・マクロ要因等により大幅に乖離する場合があります。投資は自己責任でお願いします。
              </div>
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
