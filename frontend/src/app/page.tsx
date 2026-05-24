'use client';

// Hardcoded production backend URL — always points to Render regardless of env vars
const RENDER_URL = 'https://finance-erp-platform.onrender.com';
const API_URL = (process.env.NEXT_PUBLIC_API_URL || RENDER_URL).replace(/\/$/, '');


import React, { useEffect, useState, useCallback } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { StitchTable } from '../components/ui/StitchTable';
import { CommandCenter } from '../components/chat/CommandCenter';
import { VarianceAnalysis } from '../components/dashboards/VarianceAnalysis';
import {
  UploadCloud, LayoutDashboard, Receipt, AlertTriangle, Download,
  RefreshCw, CheckCircle2, FileSpreadsheet, FileText, Coins,
  Sparkles, Info, BookOpen, TrendingUp, TrendingDown, Activity,
  Zap, ShieldAlert, Flame, Clock, Target, BarChart2, GitBranch,
  X, ChevronRight, Trash2,
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, Legend, ReferenceLine, ComposedChart, Line,
  Treemap, RadialBarChart, RadialBar, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

// ─── Palette ────────────────────────────────────────────────────────────────
const PALETTE = [
  '#818CF8','#34D399','#F87171','#FBBF24','#A78BFA',
  '#F472B6','#22D3EE','#FB923C','#4ADE80','#60A5FA',
];
const CAT_COLORS: Record<string, string> = {
  'Cloud Infrastructure': '#818CF8',
  'Finance & Banking':    '#34D399',
  'Hardware & Equipment': '#F87171',
  'Meals & Catering':     '#FBBF24',
  'Miscellaneous':        '#A78BFA',
  'Personal Expense':     '#F472B6',
  'SaaS Subscriptions':   '#22D3EE',
  'Travel & Transport':   '#FB923C',
  'Consulting & Legal':   '#60A5FA',
  'Marketing & Advertising': '#EC4899',
  'Office Supplies':      '#14B8A6',
  'Rent & Utilities':     '#A3E635',
  'HR & Recruiting':      '#F43F5E',
  'Telecommunications':   '#06B6D4',
  'Insurance & Benefits': '#10B981',
  'Taxes & Compliance':   '#F59E0B',
  'Salaries & Wages':     '#8B5CF6',
  'Professional Development': '#6366F1',
};
const getColor = (name: string, idx: number) =>
  CAT_COLORS[name] ?? PALETTE[idx % PALETTE.length];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatINR = (val?: number | null): string => {
  if (val == null || isNaN(val)) return '₹0';
  if (val >= 1_000_000_000) return `₹${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000)     return `₹${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000)         return `₹${(val / 1_000).toFixed(1)}K`;
  return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const formatMetric = (metricStr: string) => {
  if (typeof metricStr !== 'string') return metricStr;
  if (metricStr.startsWith('₹') && metricStr.length > 10) {
    const num = parseFloat(metricStr.replace(/[^0-9.-]+/g,""));
    if (!isNaN(num)) return formatINR(num);
  }
  return metricStr;
};


// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className='bg-[#0D1322] border border-[#1B253B] rounded-xl p-3 shadow-xl text-xs'>
      {label && <p className='text-slate-400 font-semibold mb-1.5'>{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className='flex items-center gap-2'>
          <span className='w-2 h-2 rounded-full' style={{ background: p.color || p.fill }}></span>
          <span className='text-slate-300'>{p.name}:</span>
          <span className='font-bold text-white'>{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ title, value, sub, Icon, glowClass, iconColor, delay = 0 }: any) => (
  <div
    className={`glass-panel border border-borderDark border-t-[2.5px] rounded-2xl p-5 flex flex-col justify-between h-[116px] glass-panel-hover animate-fadeIn ${glowClass}`}
    style={{ animationDelay: `${delay}s` }}
  >
    <div className='flex items-start justify-between'>
      <p className='text-3xs font-extrabold uppercase tracking-widest text-slate-400'>{title}</p>
      <Icon className={`w-3.5 h-3.5 opacity-50 ${iconColor}`} />
    </div>
    <div>
      <p className='text-2xl digit-wide text-white leading-none'>{value}</p>
      {sub && <p className='text-3xs text-slate-500 uppercase tracking-wide font-semibold mt-1.5 truncate'>{sub}</p>}
    </div>
  </div>
);

// ─── Section Title ────────────────────────────────────────────────────────────
const SectionTitle = ({ children, icon: Icon, iconColor = 'text-indigo-400', right }: any) => (
  <div className='flex items-center justify-between mb-4'>
    <div className='flex items-center gap-2'>
      {Icon && <Icon className={`w-3.5 h-3.5 ${iconColor}`} />}
      <h3 className='text-3xs font-extrabold uppercase tracking-widest text-slate-400'>{children}</h3>
    </div>
    {right}
  </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = ({ Icon, title, desc, onUpload }: any) => (
  <div className='glass-panel p-12 rounded-3xl border border-borderDark text-center shadow-lg max-w-md mx-auto mt-10 animate-scaleIn'>
    <div className='w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-glowPurple'>
      <Icon className='w-8 h-8 text-indigo-400 animate-pulse-slow' />
    </div>
    <h3 className='text-base font-bold text-white mb-2'>{title}</h3>
    <p className='text-slate-400 text-xs max-w-xs mx-auto mb-7 leading-relaxed'>{desc}</p>
    <button
      onClick={onUpload}
      className='px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-glowPurple transition-all hover:scale-105'
    >
      Go to Upload →
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
const RadialBarComponent = RadialBar as any;

export default function FinanceApp() {
  const {
    data, metrics, qualityIssues,
    isUploading, isLoading, activeTab,
    setData, setMetrics, setQualityIssues,
    setUploading, setLoading, setActiveTab,
    clearFilters,
  } = useFinanceStore();

  const [mounted,       setMounted]       = useState(false);
  const [cashflow,      setCashflow]      = useState<any>(null);
  const [anomalies,     setAnomalies]     = useState<any>(null);
  const [prediction,    setPrediction]    = useState<any>(null);
  const [breakdown,     setBreakdown]     = useState<any>(null);
  const [insights,      setInsights]      = useState<any>(null);
  const [variance,      setVariance]      = useState<any>(null);
  const [isRefreshing,  setIsRefreshing]  = useState(false);
  const [uploadFeedback,setUploadFeedback]= useState<string|null>(null);
  const [showNewUpload, setShowNewUpload] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen]= useState(false);
  const [spendViewMode, setSpendViewMode] = useState<'rings' | 'radar'>('rings');

  // ── Data Fetch ─────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dataR, metrR, issR, predR, cfR, anR, brR, insR, varR] = await Promise.all([
        fetch(`${API_URL}/data`),
        fetch(`${API_URL}/metrics`),
        fetch(`${API_URL}/quality-issues`),
        fetch(`${API_URL}/predict`),
        fetch(`${API_URL}/cashflow`),
        fetch(`${API_URL}/anomalies`),
        fetch(`${API_URL}/expense-breakdown`),
        fetch(`${API_URL}/insights`),
        fetch(`${API_URL}/variance`),
      ]);

      const safe = async (r: Response) => { try { const j = await r.json(); return j.error ? null : j; } catch { return null; } };

      const [dataJ, metrJ, issJ, predJ, cfJ, anJ, brJ, insJ, varJ] = await Promise.all([
        safe(dataR), safe(metrR), safe(issR), safe(predR), safe(cfR), safe(anR), safe(brR), safe(insR), safe(varR),
      ]);

      if (dataJ) setData(dataJ);
      if (metrJ) setMetrics(metrJ);
      if (issJ)  setQualityIssues(issJ);
      if (predJ) setPrediction(predJ);
      if (cfJ)   setCashflow(cfJ);
      if (anJ)   setAnomalies(anJ);
      if (brJ)   setBreakdown(brJ);
      if (insJ)  setInsights(insJ);
      if (varJ)  setVariance(varJ);
    } catch (e) {
      console.error('Backend unreachable:', e);
    } finally {
      setLoading(false);
    }
  }, [setData, setMetrics, setQualityIssues, setLoading]);

  const handleInsightAction = async (insight: any) => {
    if (!insight.actionable) return;
    setLoading(true);
    try {
      let tool = '';
      let params = {};
      if (insight.id === 'duplicates') {
        tool = 'clean_duplicates';
      } else if (insight.id === 'anomalies') {
        tool = 'mass_update';
        params = { filter_col: 'amount_inr', op: '>', val: 50000, target_col: 'status', new_val: 'High Risk' };
      }
      if (!tool) {
        setLoading(false);
        return;
      }
      const res = await fetch(`${API_URL}/ai/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, params })
      });
      if (res.ok) {
        const result = await res.json();
        setUploadFeedback(result.message);
        setIsCopilotOpen(true);
        await fetchAll();
      } else {
        alert('Action execution failed. Check backend uvicorn reloader.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Mount ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    // 1. Wipe all local storage caches
    try {
      ['finance-storage-v3','finance-storage-v2','finance-storage-v1'].forEach(k => {
        if (localStorage.getItem(k)) localStorage.removeItem(k);
      });
      sessionStorage.removeItem('ledger-uploaded');
    } catch { /* noop */ }

    // 2. Set mounted immediately — never block UI on backend availability
    setData([]);
    setMetrics(null);
    setQualityIssues([]);
    clearFilters();
    setActiveTab('Upload');
    setMounted(true);

    // 3. Reset backend in background (non-blocking) + wake up Render free tier
    const wakeAndReset = async () => {
      try {
        // Silent ping to wake Render free tier (it sleeps after 15min inactivity)
        await fetch(`${API_URL}/`, { method: 'GET' });
        // Then wipe backend state
        await fetch(`${API_URL}/reset`, { method: 'POST' });
      } catch (e) {
        // Backend cold start — silently ignore, user can still upload
        console.warn('Backend warming up:', e);
      }
    };
    wakeAndReset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleRefresh = async () => { setIsRefreshing(true); await fetchAll(); setIsRefreshing(false); };

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadFeedback(null);
    const fd = new FormData();
    fd.append('file', file);

    // Helper: try the upload, with one retry if backend is cold-starting
    const attemptUpload = async (): Promise<Response> => {
      try {
        return await fetch(`${API_URL}/upload`, { method: 'POST', body: fd });
      } catch {
        // Backend may be waking up (Render free tier cold start) — wait 4s and retry once
        setUploadFeedback('Backend is warming up, retrying in a moment...');
        await new Promise(r => setTimeout(r, 8000));
        return await fetch(`${API_URL}/upload`, { method: 'POST', body: fd });
      }
    };

    try {
      const res = await attemptUpload();
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.detail || 'Upload failed'); }
      const result = await res.json();
      setUploadFeedback(`Validated ${result.row_count} transaction rows.`);
      sessionStorage.setItem('ledger-uploaded', 'true');
      await fetchAll();
      setShowNewUpload(false);
      setActiveTab('Dashboard');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('fetch') || msg.toLowerCase().includes('network')) {
        alert('Could not reach the backend server. Please wait 30 seconds for it to wake up, then try again.\n\nBackend URL: ' + API_URL);
      } else {
        alert(msg || 'Ledger upload failed.');
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };




  // ── Exports ────────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!data?.length) return;
    const headers = ['txn_date','vendor','amount_inr','currency','category','department','status','purpose_type'];
    const rows = [headers.join(',')];
    for (const r of data) {
      rows.push(headers.map(h => {
        const v = r[h]; if (v == null) return '';
        const s = String(v).replace(/"/g, '""');
        return s.includes(',') ? `"${s}"` : s;
      }).join(','));
    }
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'));
    a.download = 'purified_ledger.csv'; a.click();
  };

  // ── Chart Data ─────────────────────────────────────────────────────────────
  const hasData = Boolean(data?.length);

  const categoryPieData = metrics?.category_dist
    ? Object.entries(metrics.category_dist).map(([n, v]) => ({ name: n, value: v as number })).sort((a,b) => b.value - a.value)
    : [];

  const departmentBarData = metrics?.department_dist
    ? Object.entries(metrics.department_dist).map(([n, v]) => ({ name: n, spend: v as number })).sort((a,b) => b.spend - a.spend).slice(0, 10)
    : [];

  // Combined cashflow: historical + forecast (with dashed line for forecast)
  const cashflowCombined = cashflow
    ? [
        ...(cashflow.historical || []).map((m: any, idx: number) => ({
          month: m.month,
          expenses: m.expenses,
          cumulative: m.cumulative,
          forecast: (cashflow.historical && idx === cashflow.historical.length - 1) ? m.expenses : null,
        })),
        ...(cashflow.forecast || []).map((m: any) => ({
          month: m.month,
          expenses: null,
          cumulative: null,
          forecast: m.expenses,
        })),
      ]
    : [];

  const treemapData = breakdown?.children
    ? breakdown.children.map((c: any, i: number) => ({ ...c, fill: getColor(c.name, i) }))
    : [];

  const anomalyList = anomalies?.anomalies ?? [];

  if (!mounted) return null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className='min-h-screen bg-background text-slate-100 flex font-sans antialiased'>

      {/* ═══ SIDEBAR ═══════════════════════════════════════════════════════ */}
      <aside className='w-60 border-r border-borderDark bg-[#06080F] flex flex-col justify-between h-screen sticky top-0 z-30 shrink-0'>
        <div className='p-5'>
          {/* Brand */}
          <div className='mb-8'>
            <div className='flex items-center gap-2.5 mb-1'>
              <div className='w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-glowPurple'>
                <Zap className='w-3.5 h-3.5 text-white' />
              </div>
              <span className='text-sm font-extrabold tracking-tight brand-gradient uppercase'>ERP Nexus</span>
            </div>
            <p className='text-3xs text-indigo-400/60 font-semibold tracking-widest uppercase ml-9.5'>Finance v2.0</p>
          </div>

          {/* Live indicator */}
          {hasData && (
            <div className='mb-6 px-3 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-2 animate-fadeIn'>
              <span className='pulse-dot bg-emerald-400 text-emerald-400 w-2 h-2'></span>
              <div>
                <p className='text-3xs font-bold text-emerald-400 uppercase tracking-wider'>Pipeline Live</p>
                <p className='text-3xs text-slate-600'>{metrics?.rows_loaded ?? data.length} rows</p>
              </div>
            </div>
          )}

          {/* Nav */}
          <nav className='space-y-0.5'>
            {[
              { id: 'Upload',        label: 'Upload',        Icon: UploadCloud    },
              { id: 'Dashboard',     label: 'Dashboard',     Icon: LayoutDashboard},
              { id: 'Transactions',  label: 'Transactions',  Icon: Receipt        },
              { id: 'Issues Log',    label: 'Issues Log',    Icon: AlertTriangle, badge: hasData ? metrics?.issues_logged : null },
              { id: 'Downloads',     label: 'Downloads',     Icon: Download       },
              { id: 'About Project', label: 'About',         Icon: Info           },
              { id: 'Quick Start',   label: 'Quick Start',   Icon: BookOpen       },
            ].map(({ id, label, Icon, badge }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  id={`nav-${id.toLowerCase().replace(/\s+/g,'-')}`}
                  onClick={() => setActiveTab(id as any)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group relative text-xs font-medium ${active ? 'bg-indigo-600/12 text-indigo-400 nav-active-glow pl-4.5' : 'text-slate-400 hover:bg-[#0D1322] hover:text-slate-200'}`}
                >
                  {active && (
                    <span className='absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-md bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.9)] animate-scaleIn' />
                  )}
                  <div className='flex items-center gap-2.5'>
                    <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${active ? 'text-indigo-400' : 'text-slate-500'}`} />
                    {label}
                  </div>
                  {badge ? (
                    <span className='px-1.5 py-0.5 rounded-full text-3xs font-extrabold bg-rose-500/15 text-rose-400 min-w-[1.2rem] text-center'>{badge}</span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Anomaly alert in sidebar */}
        {hasData && anomalyList.length > 0 && (
          <div
            className='mx-4 mb-4 p-3 rounded-xl bg-rose-500/8 border border-rose-500/15 cursor-pointer hover:bg-rose-500/12 transition-all'
            onClick={() => setActiveTab('Dashboard')}
          >
            <div className='flex items-center gap-2 mb-1'>
              <ShieldAlert className='w-3.5 h-3.5 text-rose-400' />
              <p className='text-3xs font-extrabold text-rose-400 uppercase tracking-wider'>Anomalies</p>
            </div>
            <p className='text-3xs text-slate-400'>{anomalyList.length} outlier{anomalyList.length !== 1 ? 's' : ''} detected</p>
          </div>
        )}

        <div className='p-4 border-t border-borderDark/30 text-center'>
          <p className='text-3xs text-slate-700'>FastAPI · Pandas · Next.js</p>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ══════════════════════════════════════════════════ */}
      <main className='flex-1 overflow-y-auto h-screen print:overflow-visible'>

        {/* Top Header */}
        <header className='sticky top-0 z-20 flex justify-between items-center px-8 py-4 border-b border-borderDark/40 bg-background/80 backdrop-blur-sm print:hidden'>
          <div>
            <h1 className='text-lg font-bold text-white'>{activeTab}</h1>
            <p className='text-slate-500 text-3xs mt-0.5 font-medium'>
              {activeTab === 'Dashboard'    && 'AI-powered financial intelligence & spend analytics'}
              {activeTab === 'Upload'       && 'CSV ingestion pipeline with real-time validation'}
              {activeTab === 'Transactions' && 'Purified corporate ledger · fully filterable'}
              {activeTab === 'Issues Log'   && 'Real-time anomaly & quality diagnostics log'}
              {activeTab === 'Downloads'    && 'Purified data exports & executive reports'}
              {activeTab === 'About Project'&& 'Platform architecture & feature documentation'}
              {activeTab === 'Quick Start'  && 'Step-by-step onboarding guide'}
            </p>
          </div>
          <div className='flex items-center gap-3'>
            {hasData && (
              <div className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/8 border border-emerald-500/15'>
                <span className='w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse'></span>
                <span className='text-3xs font-bold text-emerald-400 uppercase tracking-wider'>Live</span>
              </div>
            )}
            <button
              id='btn-refresh'
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
              className='flex gap-2 items-center px-4 py-2 bg-[#0D1322] border border-borderDark text-slate-400 text-xs font-semibold rounded-xl hover:bg-indigo-600/10 hover:border-indigo-500/30 hover:text-indigo-400 transition-all disabled:opacity-40'
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        <div className='p-8 space-y-0 print:p-0'>

        {/* ══════════════════════════════════════════════════════════════════
            UPLOAD
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'Upload' && (
          <section className='space-y-4 animate-fadeIn max-w-2xl mx-auto pt-4'>
            {hasData && !showNewUpload ? (
              <div className='glass-panel p-10 rounded-3xl border border-borderDark text-center animate-scaleIn'>
                <div className='w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-glowGreen'>
                  <CheckCircle2 className='w-7 h-7 text-emerald-400' />
                </div>
                <span className='text-3xs font-extrabold text-emerald-400/70 uppercase tracking-widest bg-emerald-500/8 border border-emerald-500/15 px-3 py-1 rounded-full'>
                  Pipeline Active
                </span>
                <h3 className='text-lg font-bold text-white mt-4 mb-2'>Ledger Loaded & Purified</h3>
                <p className='text-slate-400 text-xs mx-auto mb-8 leading-relaxed max-w-sm'>
                  Active ledger: <span className='text-emerald-400 font-bold'>{metrics?.rows_loaded ?? data.length} validated rows</span>
                  {metrics?.total_spend ? `, total spend ${formatINR(metrics.total_spend)}` : ''}.
                </p>
                <div className='flex gap-3 justify-center flex-wrap'>
                  <button onClick={() => setActiveTab('Dashboard')} className='px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-glowPurple transition-all hover:scale-105'>View Dashboard</button>
                  <button onClick={() => setActiveTab('Transactions')} className='px-5 py-2.5 bg-[#0D1322] border border-borderDark text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all'>Transactions</button>
                  <button onClick={() => setShowNewUpload(true)} className='px-5 py-2.5 bg-[#0D1322] border border-borderDark text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold transition-all'>Upload New</button>
                </div>
              </div>
            ) : (
              <>
                {/* Upload dropzone */}
                <div className='glass-panel p-8 rounded-3xl border border-borderDark animate-slideUp'>
                  <div className='text-center mb-6'>
                    <div className='w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glowPurple'>
                      <UploadCloud className='w-7 h-7 text-indigo-400' />
                    </div>
                    <h3 className='text-base font-bold text-white'>Ingest General Ledger</h3>
                    <p className='text-slate-400 text-xs mt-1.5 max-w-sm mx-auto leading-relaxed'>
                      Drop your corporate CSV. Our engine maps headers, standardizes currencies, deduplicates, and flags anomalies automatically.
                    </p>
                  </div>
                  <label className={`cursor-pointer flex flex-col items-center justify-center w-full h-40 bg-[#0B0F1A]/60 border-2 border-dashed rounded-2xl transition-all group ${isUploading ? 'border-indigo-500/50 bg-indigo-500/4' : 'border-borderDark hover:border-indigo-500/40'}`}>
                    {isUploading ? (
                      <div className='flex flex-col items-center gap-3'>
                        <div className='w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin'></div>
                        <p className='text-indigo-300 font-semibold text-sm'>Processing...</p>
                        <p className='text-slate-500 text-xs'>Cleaning, validating, converting currencies...</p>
                      </div>
                    ) : (
                      <div className='flex flex-col items-center gap-2 text-center'>
                        <UploadCloud className='w-8 h-8 text-slate-500 group-hover:text-indigo-400 transition-colors mb-1' />
                        <p className='text-slate-300 font-semibold group-hover:text-indigo-300 transition-colors text-sm'>Click to browse or drag & drop</p>
                        <p className='text-slate-500 text-xs'>CSV with headers: date, vendor, amount, category, department</p>
                      </div>
                    )}
                    <input type='file' accept='.csv' className='hidden' onChange={handleUpload} disabled={isUploading} />
                  </label>
                  {uploadFeedback && (
                    <div className='mt-4 p-3.5 bg-emerald-500/8 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2.5'>
                      <CheckCircle2 className='w-4 h-4 shrink-0' />{uploadFeedback}
                    </div>
                  )}
                </div>

              </>
            )}
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            DASHBOARD
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'Dashboard' && (
          <section className='space-y-5 animate-fadeIn pt-2'>
            {!hasData ? (
              <EmptyState Icon={LayoutDashboard} title='No Active Ledger' desc='Upload a CSV ledger to unlock AI-powered financial dashboards, forecasting, anomaly detection, and variance analysis.' onUpload={() => setActiveTab('Upload')} />
            ) : (
              <>
                {/* ── Row 1: KPI Cards ───────────────────────────────────── */}
                <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                  {[
                    { title: 'TOTAL SPEND',     value: formatINR(metrics?.total_spend),                    sub: 'Standardized INR equiv.',    Icon: Coins,        glowClass: 'card-glow-yellow',  iconColor: 'text-amber-400'   },
                    { title: 'MONTHLY BURN',     value: formatINR(metrics?.burn_rate),                      sub: 'Avg. monthly outflow',       Icon: Flame,        glowClass: 'card-glow-orange',  iconColor: 'text-orange-400'  },
                    { title: 'RUNWAY EST.',      value: `${metrics?.runway_months ?? '—'} mo`,              sub: 'At current burn rate',       Icon: Clock,        glowClass: 'card-glow-cyan',    iconColor: 'text-cyan-400'    },
                    { title: 'AVG TRANSACTION',  value: formatINR(metrics?.avg_txn),                        sub: `Max: ${formatINR(metrics?.max_txn)}`,Icon: Target, glowClass: 'card-glow-purple', iconColor: 'text-purple-400'  },
                  ].map((c, i) => <KpiCard key={i} {...c} delay={i * 0.06} />)}
                </div>
                <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                  {[
                    { title: 'ROWS LOADED',   value: metrics?.rows_loaded?.toLocaleString() ?? '—',   sub: `From ${metrics?.source_rows ?? '?'} source rows`, Icon: Activity,      glowClass: 'card-glow-green', iconColor: 'text-emerald-400' },
                    { title: 'ANOMALIES',     value: (anomalies?.count ?? 0).toString(),               sub: `Z-score > ${anomalies?.threshold ?? 2}σ threshold`,Icon: ShieldAlert,  glowClass: 'card-glow-red',   iconColor: 'text-rose-400'    },
                    { title: 'ISSUES LOGGED', value: metrics?.issues_logged?.toLocaleString() ?? '—', sub: `Critical: ${metrics?.issue_severity_dist?.CRITICAL ?? 0}`, Icon: AlertTriangle, glowClass: 'card-glow-amber', iconColor: 'text-amber-400' },
                    { title: 'PERSONAL EXP.', value: metrics?.personal?.toLocaleString() ?? '—',       sub: `${formatINR(metrics?.personal_spend)} non-business`,Icon: Zap,         glowClass: 'card-glow-pink',  iconColor: 'text-pink-400'    },
                  ].map((c, i) => <KpiCard key={i} {...c} delay={0.25 + i * 0.06} />)}
                </div>

                {/* ── Row 2: Cash Flow Chart + Spend Donut ──────────────── */}
                <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>

                  {/* Cash Flow Area + Forecast */}
                  <div className='lg:col-span-2 glass-panel p-6 rounded-2xl border border-borderDark glass-panel-hover animate-fadeIn' style={{ animationDelay: '0.5s' }}>
                    <SectionTitle icon={BarChart2} iconColor='text-indigo-400'
                      right={cashflow?.trend && (
                        <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-3xs font-bold ${cashflow.trend === 'Increasing' ? 'bg-rose-500/10 text-rose-400' : cashflow.trend === 'Decreasing' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                          {cashflow.trend === 'Increasing' ? <TrendingUp className='w-3 h-3'/> : <TrendingDown className='w-3 h-3'/>} {cashflow.trend}
                        </span>
                      )}
                    >
                      Cash Flow · Historical & 3-Month Forecast
                    </SectionTitle>
                    {cashflowCombined.length === 0 ? (
                      <div className='h-56 flex items-center justify-center text-slate-600 text-xs'>Insufficient date range for chart</div>
                    ) : (
                      <>
                        <div className='h-56'>
                          <ResponsiveContainer width='100%' height='100%'>
                            <ComposedChart data={cashflowCombined} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                              <defs>
                                <linearGradient id='areaGrad' x1='0' y1='0' x2='0' y2='1'>
                                  <stop offset='0%' stopColor='#818CF8' stopOpacity={0.3} />
                                  <stop offset='100%' stopColor='#818CF8' stopOpacity={0.01} />
                                </linearGradient>
                                <linearGradient id='forecastGrad' x1='0' y1='0' x2='0' y2='1'>
                                  <stop offset='0%' stopColor='#22D3EE' stopOpacity={0.25} />
                                  <stop offset='100%' stopColor='#22D3EE' stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray='2 4' stroke='#1B253B' />
                              <XAxis dataKey='month' stroke='#475569' fontSize={9} tick={{ fill: '#64748B' }} />
                              <YAxis stroke='#475569' fontSize={9} tickFormatter={v => formatINR(v)} width={60} tick={{ fill: '#64748B' }} />
                              <Tooltip content={<ChartTooltip />} />
                              <Area type='monotone' dataKey='expenses' name='Actual' stroke='#818CF8' strokeWidth={2} fill='url(#areaGrad)' dot={{ r: 3, fill: '#818CF8' }} connectNulls={false} />
                              <Area type='monotone' dataKey='forecast' name='Forecast' stroke='#22D3EE' strokeWidth={2} strokeDasharray='5 3' fill='url(#forecastGrad)' dot={{ r: 3, fill: '#22D3EE' }} connectNulls={false} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                        <div className='flex gap-5 mt-3 px-1'>
                          <div className='flex items-center gap-1.5'><span className='w-4 h-0.5 bg-indigo-400 rounded'></span><span className='text-3xs text-slate-500'>Historical</span></div>
                          <div className='flex items-center gap-1.5'><span className='w-4 h-0.5 bg-cyan-400 rounded border-dashed' style={{ borderBottom: '2px dashed #22D3EE', background: 'none' }}></span><span className='text-3xs text-slate-500'>3-Month Forecast</span></div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Spend Donut */}
                  <div className='glass-panel p-6 rounded-2xl border border-borderDark glass-panel-hover animate-fadeIn' style={{ animationDelay: '0.55s' }}>
                    <SectionTitle icon={Target} iconColor='text-pink-400'>Spend by Category</SectionTitle>
                    {categoryPieData.length === 0 ? (
                      <div className='h-56 flex items-center justify-center text-slate-600 text-xs'>No data</div>
                    ) : (
                      <div className='h-56 flex flex-col items-center'>
                        <ResponsiveContainer width='100%' height={160}>
                          <PieChart>
                            <Pie data={categoryPieData} cx='50%' cy='50%' innerRadius={48} outerRadius={72} paddingAngle={3} dataKey='value' startAngle={90} endAngle={-270}>
                              {categoryPieData.map((e, i) => (
                                <Cell key={i} fill={getColor(e.name, i)} stroke='transparent' />
                              ))}
                            </Pie>
                            <Tooltip content={<ChartTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className='w-full space-y-1 mt-1 max-h-24 overflow-y-auto pr-1'>
                          {categoryPieData.slice(0, 6).map((e, i) => (
                            <div key={i} className='flex items-center justify-between gap-2'>
                              <div className='flex items-center gap-1.5 min-w-0'>
                                <span className='w-2 h-2 rounded-full shrink-0' style={{ background: getColor(e.name, i) }}></span>
                                <span className='text-slate-300 truncate text-3xs'>{e.name}</span>
                              </div>
                              <span className='font-bold text-slate-400 shrink-0 text-3xs'>
                                {metrics?.total_spend ? ((e.value / metrics.total_spend) * 100).toFixed(1) : 0}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Row 3: Department Bar + Treemap ───────────────────── */}
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>

                  {/* Department Horizontal Bar */}
                  <div className='glass-panel p-6 rounded-2xl border border-borderDark glass-panel-hover animate-fadeIn' style={{ animationDelay: '0.6s' }}>
                    <SectionTitle icon={BarChart2} iconColor='text-emerald-400'>Top Departments by Spend</SectionTitle>
                    {departmentBarData.length === 0 ? (
                      <div className='h-56 flex items-center justify-center text-slate-600 text-xs'>No department data</div>
                    ) : (
                      <div className='h-56'>
                        <ResponsiveContainer width='100%' height='100%'>
                          <BarChart data={departmentBarData} layout='vertical' margin={{ top: 2, right: 24, left: 60, bottom: 2 }}>
                            <defs>
                              <linearGradient id='deptG' x1='0' y1='0' x2='1' y2='0'>
                                <stop offset='0%' stopColor='#4F46E5' stopOpacity={0.4} />
                                <stop offset='100%' stopColor='#818CF8' stopOpacity={1} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray='2 4' stroke='#1B253B' horizontal={false} />
                            <XAxis type='number' stroke='#475569' fontSize={9} tickFormatter={v => formatINR(v)} tick={{ fill: '#64748B' }} />
                            <YAxis dataKey='name' type='category' stroke='#64748B' fontSize={9} width={56} axisLine={false} tickLine={false} tick={{ fill: '#94A3B8' }} />
                            <Tooltip content={<ChartTooltip />} />
                            <Bar dataKey='spend' name='Spend' fill='url(#deptG)' radius={[0, 6, 6, 0]} barSize={9} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Expense Audit Dynamics (Concentric Spend Rings & Radar Vectors) */}
                  <div className='glass-panel p-6 rounded-2xl border border-borderDark glass-panel-hover animate-fadeIn' style={{ animationDelay: '0.65s' }}>
                    <SectionTitle 
                      icon={GitBranch} 
                      iconColor='text-amber-400'
                      right={
                        <div className='flex items-center gap-1 bg-[#0A0D16] border border-borderDark p-0.5 rounded-lg shrink-0'>
                          <button 
                            onClick={() => setSpendViewMode('rings')}
                            className={`px-2.5 py-1 text-3xs font-extrabold rounded-md transition-all ${spendViewMode === 'rings' ? 'bg-indigo-600 text-white shadow-glowPurple' : 'text-slate-400 hover:text-slate-200'}`}
                          >
                            RINGS
                          </button>
                          <button 
                            onClick={() => setSpendViewMode('radar')}
                            className={`px-2.5 py-1 text-3xs font-extrabold rounded-md transition-all ${spendViewMode === 'radar' ? 'bg-indigo-600 text-white shadow-glowPurple' : 'text-slate-400 hover:text-slate-200'}`}
                          >
                            RADAR
                          </button>
                        </div>
                      }
                    >
                      Expense Audit Dynamics
                    </SectionTitle>
                    {departmentBarData.length === 0 ? (
                      <div className='h-56 flex items-center justify-center text-slate-600 text-xs'>No spend data</div>
                    ) : (
                      <div className='h-56 relative flex items-center justify-center'>
                        {spendViewMode === 'rings' ? (
                          <div className='w-full h-full flex items-center justify-between'>
                            <div className='w-[60%] h-full'>
                              <ResponsiveContainer width='100%' height='100%'>
                                <RadialBarChart 
                                  cx="50%" 
                                  cy="50%" 
                                  innerRadius="20%" 
                                  outerRadius="100%" 
                                  barSize={8} 
                                  data={departmentBarData.slice(0, 6).map((d: any, idx: number) => ({
                                    name: d.name,
                                    value: d.spend,
                                    fill: getColor(d.name, idx)
                                  })).reverse()}
                                >
                                  <RadialBarComponent
                                    minAngle={15}
                                    background={{ fill: '#080C16' }}
                                    clockWise
                                    dataKey="value"
                                    radius={4}
                                  />
                                  <Tooltip content={<ChartTooltip />} />
                                </RadialBarChart>
                              </ResponsiveContainer>
                            </div>
                            <div className='w-[38%] space-y-1.5 max-h-48 overflow-y-auto pr-1'>
                              {departmentBarData.slice(0, 6).map((d: any, idx: number) => (
                                <div key={idx} className='flex flex-col gap-0.5 border-b border-borderDark/20 pb-1.5'>
                                  <div className='flex items-center gap-1.5'>
                                    <span className='w-2 h-2 rounded-full shrink-0' style={{ background: getColor(d.name, idx) }}></span>
                                    <span className='text-slate-300 font-semibold text-3xs truncate'>{d.name.toUpperCase()}</span>
                                  </div>
                                  <span className='font-bold font-mono text-slate-400 text-3xs pl-3.5'>{formatINR(d.spend)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className='w-full h-full'>
                            <ResponsiveContainer width='100%' height='100%'>
                              <RadarChart cx="50%" cy="50%" outerRadius="65%" data={variance ? variance.slice(0, 8).map((v: any) => ({
                                subject: v.department,
                                Actual: v.actual,
                                Budget: v.budget,
                              })) : []}>
                                <PolarGrid stroke="#1B253B" />
                                <PolarAngleAxis dataKey="subject" stroke="#64748B" fontSize={8} tick={{ fill: '#64748B' }} />
                                <PolarRadiusAxis stroke="#1B253B" tick={{ fill: '#475569' }} fontSize={6} tickFormatter={(val) => formatINR(val)} />
                                <Radar name="Approved Budget" dataKey="Budget" stroke="#10B981" fill="#10B981" fillOpacity={0.06} />
                                <Radar name="Actual Spend" dataKey="Actual" stroke="#818CF8" fill="#818CF8" fillOpacity={0.35} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend verticalAlign="bottom" height={18} iconSize={8} wrapperStyle={{ fontSize: '8px' }} />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Row 4: Anomalies Table + Prediction Card ──────────── */}
                <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>

                  {/* Anomalies */}
                  <div className='lg:col-span-2 glass-panel p-6 rounded-2xl border border-borderDark animate-fadeIn' style={{ animationDelay: '0.7s' }}>
                    <SectionTitle icon={ShieldAlert} iconColor='text-rose-400'
                      right={anomalyList.length > 0 && (
                        <span className='px-2.5 py-1 rounded-full text-3xs font-extrabold bg-rose-500/10 text-rose-400 border border-rose-500/20'>
                          {anomalyList.length} outlier{anomalyList.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    >
                      Statistical Anomalies · Z-Score Detection
                    </SectionTitle>
                    {anomalyList.length === 0 ? (
                      <div className='p-10 text-center border border-dashed border-borderDark rounded-xl bg-[#090E1A]/30'>
                        <CheckCircle2 className='w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60' />
                        <p className='text-slate-400 text-xs font-semibold'>No statistical anomalies detected</p>
                        <p className='text-slate-600 text-3xs mt-1'>All transaction amounts are within 2σ of the mean</p>
                      </div>
                    ) : (
                      <div className='overflow-x-auto rounded-xl border border-borderDark'>
                        <table className='w-full text-left text-3xs border-collapse'>
                          <thead>
                            <tr className='bg-[#0A0D16] border-b border-borderDark text-slate-500 font-extrabold uppercase tracking-wider'>
                              {['Row','Severity','Vendor','Amount','Z-Score','Reason'].map(h => (
                                <th key={h} className='p-3 whitespace-nowrap'>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {anomalyList.slice(0, 8).map((a: any, i: number) => (
                              <tr key={i} className='border-b border-borderDark/40 table-row-hover transition-colors'>
                                <td className='p-3 font-mono text-slate-500'>{a.row}</td>
                                <td className='p-3'>
                                  <span className={`px-2 py-0.5 rounded-full font-extrabold tracking-wider ${
                                    a.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400' : a.severity === 'WARNING' ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'
                                  }`}>{a.severity}</span>
                                </td>
                                <td className='p-3 font-semibold text-white max-w-[110px] truncate'>{a.vendor}</td>
                                <td className='p-3 font-mono text-emerald-400 font-bold'>{formatINR(a.amount_inr)}</td>
                                <td className='p-3'>
                                  <span className={`font-extrabold font-mono ${Math.abs(a.z_score) > 3 ? 'text-rose-400' : 'text-amber-400'}`}>
                                    {a.z_score > 0 ? '+' : ''}{a.z_score.toFixed(2)}σ
                                  </span>
                                </td>
                                <td className='p-3 text-slate-400 max-w-[180px] truncate'>{a.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {anomalyList.length > 8 && (
                          <div className='text-center py-3 border-t border-borderDark text-3xs text-slate-500'>
                            + {anomalyList.length - 8} more anomalies. Check Issues Log for full list.
                          </div>
                        )}
                      </div>
                    )}
                    {anomalies && (
                      <div className='flex gap-4 mt-3 px-1 text-3xs text-slate-600'>
                        <span>Mean: <span className='text-slate-400 font-mono font-semibold'>{formatINR(anomalies.mean)}</span></span>
                        <span>Std Dev: <span className='text-slate-400 font-mono font-semibold'>{formatINR(anomalies.std)}</span></span>
                        <span>Threshold: <span className='text-slate-400 font-mono font-semibold'>&gt;{anomalies.threshold}σ</span></span>
                      </div>
                    )}
                  </div>

                  {/* Real-time Financial Data Insights Panel */}
                  <div className='space-y-4 flex flex-col'>
                    <div className='glass-panel p-6 rounded-2xl border border-borderDark flex-1 flex flex-col justify-start animate-fadeIn' style={{ animationDelay: '0.72s' }}>
                      <div>
                        <SectionTitle icon={Sparkles} iconColor='text-indigo-400'>
                          Financial Data Insights
                        </SectionTitle>
                        <p className='text-3xs text-slate-500 font-semibold uppercase tracking-wider mb-4'>
                          AI-extracted operational insights and anomalies
                        </p>
                      </div>
                      
                      <div className='space-y-3 flex-1 overflow-y-auto max-h-[320px] pr-3 mr-[-4px]'>
                        {!insights || !insights.insights || insights.insights.length === 0 ? (
                          <div className='p-6 text-center border border-dashed border-borderDark rounded-xl bg-[#090E1A]/20'>
                            <CheckCircle2 className='w-6 h-6 text-emerald-400 mx-auto mb-2 opacity-60' />
                            <p className='text-slate-400 text-3xs font-bold uppercase tracking-wider'>Healthy Balance</p>
                            <p className='text-slate-600 text-3xs mt-1'>No outstanding leakage, double-billing duplicates, or critical Z-score outliers detected.</p>
                          </div>
                        ) : (
                          insights.insights.map((insight: any, i: number) => {
                            let glowClass = 'border-indigo-500/20 bg-[#0A0D16]/30';
                            let iconColor = 'text-indigo-400';
                            let IconComponent = Info;
                            
                            if (insight.id === 'duplicates') {
                              glowClass = 'border-rose-500/30 bg-[#7F1D1D]/5 hover:border-rose-500/50 hover:bg-[#7F1D1D]/10 shadow-[0_0_12px_rgba(239,68,68,0.04)] hover:shadow-[0_0_18px_rgba(239,68,68,0.1)]';
                              iconColor = 'text-rose-400';
                              IconComponent = Trash2;
                            } else if (insight.id === 'anomalies') {
                              glowClass = 'border-rose-500/30 bg-[#7F1D1D]/5 hover:border-rose-500/50 hover:bg-[#7F1D1D]/10 shadow-[0_0_12px_rgba(239,68,68,0.04)] hover:shadow-[0_0_18px_rgba(239,68,68,0.1)]';
                              iconColor = 'text-rose-400';
                              IconComponent = ShieldAlert;
                            } else if (insight.id === 'leakage') {
                              glowClass = 'border-amber-500/30 bg-[#78350F]/5 hover:border-amber-500/50 hover:bg-[#78350F]/10 shadow-[0_0_12px_rgba(245,158,11,0.04)] hover:shadow-[0_0_18px_rgba(245,158,11,0.1)]';
                              iconColor = 'text-amber-400';
                              IconComponent = Zap;
                            } else if (insight.id === 'dominance') {
                              glowClass = 'border-indigo-500/30 bg-[#1E1B4B]/5 hover:border-indigo-500/50 hover:bg-[#1E1B4B]/10 shadow-[0_0_12px_rgba(99,102,241,0.04)] hover:shadow-[0_0_18px_rgba(99,102,241,0.1)]';
                              iconColor = 'text-indigo-400';
                              IconComponent = BarChart2;
                            } else if (insight.id === 'peak') {
                              glowClass = 'border-cyan-500/30 bg-[#1A365D]/5 hover:border-cyan-500/50 hover:bg-[#1A365D]/10 shadow-[0_0_12px_rgba(34,211,238,0.04)] hover:shadow-[0_0_18px_rgba(34,211,238,0.1)]';
                              iconColor = 'text-cyan-400';
                              IconComponent = Coins;
                            }
                            
                            return (
                              <div 
                                key={insight.id || i}
                                onClick={() => insight.actionable && handleInsightAction(insight)}
                                className={`group p-4 rounded-xl border text-left transition-all duration-300 ${glowClass} ${insight.actionable ? 'cursor-pointer hover:scale-[1.015]' : ''}`}
                              >
                                <div className='mb-2.5'>
                                  <div className='flex items-start gap-2.5 min-w-0 mb-1.5'>
                                    <IconComponent className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
                                    <h4 className='text-xs font-extrabold text-white uppercase tracking-wider leading-snug'>{insight.title}</h4>
                                  </div>
                                  <div className='pl-[26px]'>
                                    <span className={`text-[10px] font-mono font-extrabold inline-block whitespace-nowrap px-2.5 py-0.5 rounded-full border bg-black/20 transition-colors uppercase tracking-wider ${
                                      insight.id === 'duplicates' || insight.id === 'anomalies'
                                        ? 'text-rose-400 border-rose-500/20 bg-rose-500/5 group-hover:bg-rose-500/10'
                                        : insight.id === 'leakage'
                                        ? 'text-amber-400 border-amber-500/20 bg-amber-500/5 group-hover:bg-amber-500/10'
                                        : insight.id === 'dominance'
                                        ? 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5 group-hover:bg-indigo-500/10'
                                        : insight.id === 'peak'
                                        ? 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5 group-hover:bg-cyan-500/10'
                                        : `${iconColor} border-current/20 bg-current/5`
                                    }`}>
                                      {formatMetric(insight.metric)}
                                    </span>
                                  </div>
                                </div>
                                <p className='text-xs text-slate-400 leading-relaxed font-medium mb-3'>
                                  {insight.desc}
                                </p>
                                {insight.actionable && (
                                  <div className='flex flex-wrap items-center justify-between gap-2 border-t border-borderDark/20 pt-3 mt-3'>
                                    <span className='text-[10px] text-slate-500 font-bold uppercase tracking-widest'>Diagnostic Action</span>
                                    <span className={`text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-borderDark/30 transition-all bg-[#00000030] group-hover:bg-black/50 group-hover:border-current/30 ${iconColor}`}>
                                      {insight.actionText} <ChevronRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Row 5: Variance Analysis ───────────────────────────── */}
                <div className='animate-fadeIn' style={{ animationDelay: '0.9s' }}>
                  <VarianceAnalysis />
                </div>
              </>
            )}
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TRANSACTIONS
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'Transactions' && (
          <section className='space-y-4 animate-fadeIn pt-2'>
            <div className='glass-panel p-6 rounded-3xl border border-borderDark'>
              <div className='flex items-center justify-between mb-5'>
                <div>
                  <h3 className='text-sm font-bold text-white'>Corporate Transaction Registry</h3>
                  <p className='text-slate-500 text-3xs mt-0.5'>Purified · validated · INR-standardized</p>
                </div>
                {hasData && (
                  <span className='text-3xs font-bold text-indigo-400/80 uppercase tracking-widest bg-indigo-500/8 border border-indigo-500/15 px-3 py-1 rounded-full'>
                    {data.length} records
                  </span>
                )}
              </div>
              <StitchTable />
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ISSUES LOG
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'Issues Log' && (
          <section className='space-y-4 animate-fadeIn pt-2'>
            {!hasData ? (
              <EmptyState Icon={AlertTriangle} title='No Ledger to Audit' desc='Upload a CSV to detect personal expenses, duplicate records, and data quality anomalies.' onUpload={() => setActiveTab('Upload')} />
            ) : (
              <div className='glass-panel p-6 rounded-3xl border border-borderDark'>
                <div className='flex items-start justify-between mb-5'>
                  <div>
                    <h3 className='text-sm font-bold text-white'>Quality Diagnostics & Anomalies</h3>
                    <p className='text-slate-500 text-3xs mt-1 max-w-xl leading-relaxed'>Structural anomalies detected during ingestion. CRITICAL rows are excluded from the clean ledger.</p>
                  </div>
                  {qualityIssues?.length > 0 && (
                    <div className='flex items-center gap-2 shrink-0'>
                      {['CRITICAL','WARNING','INFO'].map(sev => {
                        const count = qualityIssues.filter((q: any) => q.severity === sev).length;
                        if (!count) return null;
                        return (
                          <span 
                            key={sev} 
                            className={`px-3 py-1.5 rounded-full text-3xs font-extrabold tracking-wider border transition-all ${
                              sev === 'CRITICAL' 
                                ? 'bg-[#7F1D1D]/30 border-[#991B1B]/40 text-[#FCA5A5] shadow-[0_0_10px_rgba(239,68,68,0.15)]' 
                                : sev === 'WARNING' 
                                ? 'bg-[#78350F]/30 border-[#92400E]/40 text-[#FBBF24] shadow-[0_0_10px_rgba(245,158,11,0.15)]' 
                                : 'bg-[#1E1B4B]/30 border-[#312E81]/40 text-[#A5B4FC] shadow-[0_0_10px_rgba(99,102,241,0.15)]'
                            }`}
                          >
                            {sev}: {count}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                {(!qualityIssues || qualityIssues.length === 0) ? (
                  <div className='p-14 text-center border border-dashed border-borderDark rounded-2xl'>
                    <CheckCircle2 className='w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-60' />
                    <p className='text-slate-400 text-sm font-semibold'>No exceptions detected</p>
                    <p className='text-slate-600 text-xs mt-1'>All records passed validation cleanly</p>
                  </div>
                ) : (
                  <div className='overflow-x-auto rounded-xl border border-borderDark bg-[#0B0F1A]/30'>
                    <table className='w-full text-left text-xs border-collapse'>
                      <thead>
                        <tr className='bg-[#0A0D16] border-b border-borderDark text-slate-500 font-extrabold uppercase tracking-wider text-3xs'>
                          {['Row','Severity','Field','Raw Value','Diagnostic'].map(h => <th key={h} className='p-4 whitespace-nowrap'>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {qualityIssues.map((issue: any, i: number) => (
                          <tr key={i} className='border-b border-borderDark/40 table-row-hover transition-colors'>
                            <td className='p-4 font-mono text-slate-500 text-3xs'>{issue.row}</td>
                            <td className='p-4'>
                              <span className={`px-2 py-0.5 rounded-full text-3xs font-extrabold tracking-wider ${issue.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400' : issue.severity === 'WARNING' ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                {issue.severity}
                              </span>
                            </td>
                            <td className='p-4 font-mono text-indigo-300 font-semibold text-3xs'>{issue.field}</td>
                            <td className='p-4 truncate max-w-xs text-slate-300 font-medium text-3xs'>{issue.value || '(empty)'}</td>
                            <td className='p-4 text-slate-400 leading-normal text-xs'>{issue.issue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            DOWNLOADS
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'Downloads' && (
          <section className='space-y-4 print:hidden animate-fadeIn pt-2'>
            {!hasData ? (
              <EmptyState Icon={Download} title='No Reports Available' desc='Upload a CSV ledger to generate purified data exports and executive audit reports.' onUpload={() => setActiveTab('Upload')} />
            ) : (
              <div className='grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto mt-2'>
                {[
                  {
                    Icon: FileSpreadsheet, title: 'Purified General Ledger', desc: 'Filtered, cleaned, and INR-standardized CSV with all validated transaction records.',
                    meta: [{ k: 'Records', v: data.length.toString() }, { k: 'Format', v: 'CSV (UTF-8)' }, { k: 'Columns', v: '8 standard' }],
                    btn: 'Download CSV', onClick: exportCSV, btnClass: 'bg-emerald-600 hover:bg-emerald-500 shadow-glowGreen', iconClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  },
                  {
                    Icon: FileText, title: 'Executive Audit Report', desc: 'Print a polished PDF summary with KPIs, charts, variance analysis, and anomaly flags.',
                    meta: [{ k: 'Format', v: 'PDF (Print)' }, { k: 'Includes', v: 'KPIs + Charts' }, { k: 'Layout', v: 'A4 Ready' }],
                    btn: 'Print PDF', onClick: () => window.print(), btnClass: 'bg-indigo-600 hover:bg-indigo-500 shadow-glowPurple', iconClass: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                  },
                ].map(({ Icon, title, desc, meta, btn, onClick, btnClass, iconClass }, i) => (
                  <div key={i} className='glass-panel p-8 rounded-3xl border border-borderDark flex flex-col items-center text-center gap-5 glass-panel-hover animate-slideUp' style={{ animationDelay: `${i * 0.1}s` }}>
                    <div className={`w-14 h-14 border rounded-2xl flex items-center justify-center ${iconClass}`}>
                      <Icon className='w-6 h-6' />
                    </div>
                    <div>
                      <h3 className='text-sm font-bold text-white mb-1'>{title}</h3>
                      <p className='text-slate-400 text-xs leading-relaxed max-w-xs'>{desc}</p>
                    </div>
                    <div className='w-full border-t border-borderDark/20 pt-4 space-y-2.5'>
                      {meta.map(({ k, v }) => (
                        <div key={k} className='flex justify-between items-center px-1 text-3xs border-b border-borderDark/10 pb-2 last:border-b-0 last:pb-0'>
                          <span className='text-slate-500 font-semibold uppercase tracking-wider'>{k}</span>
                          <span className='text-slate-200 font-bold font-mono'>{v}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={onClick} className={`w-full py-2.5 text-white rounded-xl text-xs font-bold transition-all hover:scale-105 ${btnClass}`}>{btn}</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ABOUT PROJECT
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'About Project' && (
          <section className='max-w-4xl mx-auto pt-2 animate-fadeIn'>
            <div className='glass-panel p-8 rounded-3xl border border-borderDark space-y-6'>
              <div className='flex items-center gap-4 border-b border-borderDark/40 pb-5'>
                <div className='w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center shadow-glowPurple'>
                  <Info className='w-6 h-6 text-indigo-400' />
                </div>
                <div>
                  <h2 className='text-lg font-bold text-white'>AI-Native ERP Finance Platform</h2>
                  <p className='text-slate-400 text-xs mt-0.5'>Enterprise Expense Audit · Cash Purification · Forecasting Engine</p>
                </div>
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
                {[
                  { dot: 'bg-indigo-400', title: 'Intelligent Data Ingestion', body: 'Fuzzy header mapping resolves "Amt", "Cost", "Transaction Value" to standard schemas. Multi-currency conversion (USD, EUR, GBP, SGD, AED → INR) with real exchange rates.' },
                  { dot: 'bg-emerald-400', title: 'Statistical Anomaly Detection', body: 'Z-score analysis on all transaction amounts flags outliers greater than 2σ from the mean. Severity bands: INFO (>2σ), WARNING (>2.5σ), CRITICAL (>3.5σ).' },
                  { dot: 'bg-amber-400',  title: '3-Month Linear Forecasting', body: 'Time-series linear regression on monthly spend data. Predicts Q3 burn rate and cumulative cash flow with trend classification (Increasing / Decreasing / Stable).' },
                  { dot: 'bg-rose-400',   title: 'Personal Expense Detection', body: 'Keyword matching for Netflix, Spotify, Amazon Retail, Starbucks, Grocery chains flags non-business charges in the corporate ledger for audit and reimbursement recovery.' },
                ].map((b, i) => (
                  <div key={i} className='p-5 rounded-xl bg-[#0B101E]/50 border border-borderDark/40 space-y-2'>
                    <h4 className='text-xs font-bold text-white flex items-center gap-2'><span className={`w-1.5 h-1.5 rounded-full ${b.dot}`}></span>{b.title}</h4>
                    <p className='text-slate-300 text-xs leading-relaxed'>{b.body}</p>
                  </div>
                ))}
              </div>
              <div className='grid grid-cols-3 gap-3 border-t border-borderDark/30 pt-5'>
                {[
                  { c: 'text-purple-400', l: 'Frontend',  d: 'Next.js 14 + Recharts + Zustand' },
                  { c: 'text-cyan-400',   l: 'Backend',   d: 'FastAPI + Pandas + NumPy' },
                  { c: 'text-emerald-400',l: 'Analytics', d: 'Z-Score · Linear Regression · Treemap' },
                ].map((a, i) => (
                  <div key={i} className='p-4 bg-[#090D16]/70 border border-borderDark/40 rounded-xl text-center'>
                    <p className={`text-xs font-semibold ${a.c}`}>{a.l}</p>
                    <p className='text-slate-500 text-3xs mt-1'>{a.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            QUICK START
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'Quick Start' && (
          <section className='max-w-3xl mx-auto pt-2 animate-fadeIn'>
            <div className='glass-panel p-8 rounded-3xl border border-borderDark space-y-4'>
              <div className='flex items-center gap-4 border-b border-borderDark/40 pb-5'>
                <div className='w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center shadow-glowPurple'>
                  <BookOpen className='w-6 h-6 text-indigo-400' />
                </div>
                <div>
                  <h2 className='text-lg font-bold text-white'>Quick Start Guide</h2>
                  <p className='text-slate-400 text-xs mt-0.5'>Audit your corporate ledger in 4 steps</p>
                </div>
              </div>
              {[
                { n: '01', t: 'Upload Your CSV', d: 'Go to Upload → browse your raw general ledger. The system auto-maps "Amt", "Cost", "Transaction Value" headers and normalizes currencies.', accent: 'border-indigo-500', bg: 'bg-indigo-500/5' },
                { n: '02', t: 'Analyze the Dashboard', d: 'The Dashboard unlocks 8 KPI cards, cash flow area chart with 3-month forecast, category donut, department bar chart, and expense treemap.', accent: 'border-emerald-500', bg: 'bg-emerald-500/5' },
                { n: '03', t: 'Use AI Co-Pilot', d: 'Open the AI Co-Pilot (bottom right). Ask: "What is our burn rate?", "Flag expenses over ₹50,000 as High Risk", "Clean duplicate rows".', accent: 'border-amber-500', bg: 'bg-amber-500/5' },
                { n: '04', t: 'Export & Report', d: 'Navigate to Downloads to export a clean INR-standardized CSV or print a polished executive PDF audit summary.', accent: 'border-cyan-500', bg: 'bg-cyan-500/5' },
              ].map((s, i) => (
                <div key={i} className={`p-5 rounded-xl border-l-4 border-y border-r border-borderDark/40 flex gap-4 animate-fadeIn ${s.accent} ${s.bg}`} style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className='w-8 h-8 rounded-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 font-mono text-xs font-extrabold flex items-center justify-center shrink-0'>{s.n}</div>
                  <div>
                    <h4 className='text-sm font-bold text-white mb-1'>{s.t}</h4>
                    <p className='text-slate-400 text-xs leading-relaxed'>{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        </div>
      </main>

      {/* ═══ AI CO-PILOT ═════════════════════════════════════════════════════ */}
      <CommandCenter isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />
      {!isCopilotOpen && (
        <div className='fixed bottom-6 right-6 z-50 print:hidden'>
          <div className='absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20 scale-110' style={{ animationDuration: '3s' }}></div>
          <button
            id='btn-ai-copilot-open'
            onClick={() => setIsCopilotOpen(true)}
            className='relative flex items-center gap-2 px-4 py-3 bg-[#0C1222]/95 border border-indigo-500/30 hover:border-indigo-500/60 backdrop-blur-md text-white rounded-full shadow-[0_0_24px_rgba(99,102,241,0.25)] hover:shadow-[0_0_36px_rgba(99,102,241,0.45)] hover:scale-105 transition-all duration-300 group'
          >
            <Sparkles className='w-3.5 h-3.5 text-indigo-400 group-hover:rotate-12 transition-transform' />
            <span className='text-xs font-bold tracking-wider uppercase pr-1 text-slate-200'>AI Co-Pilot</span>
          </button>
        </div>
      )}
    </div>
  );
}
