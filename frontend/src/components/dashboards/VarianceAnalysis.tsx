'use client';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://finance-erp-platform.onrender.com').replace(/\/$/, '');

import React, { useEffect, useState } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import { AlertCircle, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react';

interface VarianceItem {
  department: string;
  budget: number;
  actual: number;
  variance: number;
  status: string;
  pct_used: number;
}

export const VarianceAnalysis = () => {
  const { data } = useFinanceStore();
  const [varianceData, setVarianceData] = useState<VarianceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!data || data.length === 0) return;
    
    setIsLoading(true);
    fetch(`${API_URL}/variance`)
      .then(res => res.json())
      .then(resData => {
        if (Array.isArray(resData)) {
          // Sort departments: over-budget first, then higher percent utilized
          const sorted = [...resData].sort((a, b) => b.pct_used - a.pct_used);
          setVarianceData(sorted);
        }
      })
      .catch(err => console.error("Could not fetch variance levels", err))
      .finally(() => setIsLoading(false));
  }, [data]); // Reload variance dynamically when ledger data updates (including AI Chatbot actions!)

  if (!data || data.length === 0) return null;

  return (
    <div className='glass-panel p-6 rounded-2xl border border-borderDark shadow-xl'>
      <div className='flex justify-between items-center mb-6'>
        <h3 className='text-xs font-extrabold uppercase text-slate-400 tracking-wider'>Budget vs Actual (Variance Analysis)</h3>
        <span className='text-3xs text-slate-500 font-extrabold uppercase tracking-wide bg-[#0A0D16] px-2 py-0.5 rounded border border-borderDark'>
          Direct Core Ledgers
        </span>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        {isLoading ? (
          <div className='col-span-1 md:col-span-2 p-12 text-center text-slate-500 italic text-xs'>
            Syncing corporate ledger sheets...
          </div>
        ) : varianceData.length === 0 ? (
          <div className='col-span-1 md:col-span-2 p-12 text-center text-slate-500 text-xs'>
            No department allocations found to analyze.
          </div>
        ) : (
          varianceData.map((item, i) => {
            const isOver = item.status === 'Over Budget';
            const progress = Math.min(100, item.pct_used);
            
            return (
              <div 
                key={i} 
                className='p-4 rounded-xl bg-[#0B101E]/40 border border-borderDark/40 flex flex-col justify-between space-y-3'
              >
                {/* Department Info */}
                <div className='flex justify-between items-start'>
                  <div>
                    <p className='font-bold text-white text-xs'>{item.department}</p>
                    <p className='text-3xs text-slate-500 font-semibold uppercase mt-0.5'>
                      Budget: ₹{item.budget.toLocaleString()}
                    </p>
                  </div>
                  <div className='text-right'>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-4xs font-extrabold tracking-wider uppercase border ${
                      isOver 
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {isOver ? (
                        <>
                          <TrendingUp className="w-2.5 h-2.5" />
                          +{item.pct_used.toFixed(0)}%
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-2.5 h-2.5" />
                          {item.pct_used.toFixed(0)}%
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Progress Bar Gradient */}
                <div className='space-y-1'>
                  <div className='w-full h-1.5 bg-[#090D16] rounded-full overflow-hidden border border-borderDark/30'>
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOver 
                          ? 'bg-gradient-to-r from-orange-500 to-rose-500' 
                          : 'bg-gradient-to-r from-indigo-500 to-emerald-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className='flex justify-between text-3xs font-semibold uppercase tracking-wider text-slate-500'>
                    <span>Used: ₹{item.actual.toLocaleString()}</span>
                    <span className={isOver ? 'text-rose-400' : 'text-slate-400'}>
                      {isOver ? 'Over:' : 'Left:'} ₹{Math.abs(item.variance).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
