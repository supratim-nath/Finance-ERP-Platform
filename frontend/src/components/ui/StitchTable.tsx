'use client';

import React, { useState } from 'react';
import { useFinanceStore, ExpenseRow } from '../../store/useFinanceStore';
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, Filter, X,
  SlidersHorizontal, Calendar, ChevronDown, ChevronUp
} from 'lucide-react';

// ─── Status badge theming ─────────────────────────────────────────────────────
const getStatusBadge = (status: string) => {
  const s = status?.toLowerCase() ?? '';
  if (s.includes('high risk') || s.includes('critical'))
    return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
  if (s.includes('review') || s.includes('warning') || s.includes('logged'))
    return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
  if (s.includes('personal'))
    return 'bg-pink-500/10 text-pink-400 border border-pink-500/20';
  return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
};

const getPurposeBadge = (purpose: string) => {
  if (purpose === 'Personal') return 'bg-pink-500/8 text-pink-400';
  return 'bg-sky-500/8 text-sky-400';
};

// ─── Filter Pill component ────────────────────────────────────────────────────
const FilterPill = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`px-2.5 py-1 rounded-full transition-all border text-3xs font-semibold whitespace-nowrap ${
      active
        ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300'
        : 'bg-transparent border-borderDark text-slate-400 hover:text-slate-200 hover:border-slate-500'
    }`}
  >
    {label}
  </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export const StitchTable = () => {
  const {
    data, searchTerm, sortCol, sortAsc,
    categoryFilters, statusFilters, departmentFilters, currencyFilters, purposeFilters,
    amountMin, amountMax, dateFrom, dateTo,
    currentPage, itemsPerPage,
    setSearchTerm, setSorting,
    toggleCategoryFilter, toggleStatusFilter, toggleDepartmentFilter,
    toggleCurrencyFilter, togglePurposeFilter,
    setAmountFilters, setDateRange,
    setCurrentPage, setItemsPerPage, clearFilters,
  } = useFinanceStore();

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className='p-16 text-slate-500 text-center font-medium border border-dashed border-borderDark rounded-2xl bg-[#090E1A]/40'>
        <Filter className='w-10 h-10 mx-auto mb-3 opacity-30' />
        <p className='text-sm font-semibold'>No transaction records available</p>
        <p className='text-xs mt-1 text-slate-600'>Upload a general ledger file from the Upload tab.</p>
      </div>
    );
  }

  // Extract unique values for each filter dimension
  const standardKeys = ['txn_date', 'vendor', 'amount_raw', 'amount_inr', 'category', 'department', 'status', 'purpose_type', 'currency', 'raw_row_index'];
  const customKeys = Array.from(new Set(data.flatMap(row => Object.keys(row)).filter(k => !standardKeys.includes(k))));

  const uniqueCategories  = Array.from(new Set(data.map(r => r.category).filter(Boolean))).sort();
  const uniqueStatuses    = Array.from(new Set(data.map(r => r.status).filter(Boolean))).sort();
  const uniqueDepartments = Array.from(new Set(data.map(r => r.department).filter(Boolean))).sort();
  const uniqueCurrencies  = Array.from(new Set(data.map(r => r.currency).filter(Boolean))).sort();
  const uniquePurposes    = Array.from(new Set(data.map(r => r.purpose_type).filter(Boolean))).sort();

  // ── Active filter count ───────────────────────────────────────────────────
  const activeFilterCount = [
    searchTerm,
    ...categoryFilters, ...statusFilters, ...departmentFilters,
    ...currencyFilters, ...purposeFilters,
    amountMin !== '' ? '1' : '',
    amountMax !== '' ? '1' : '',
    dateFrom, dateTo,
  ].filter(Boolean).length;

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filteredData = data.filter((row: ExpenseRow) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const match = Object.values(row).some(v => v != null && String(v).toLowerCase().includes(term));
      if (!match) return false;
    }
    if (categoryFilters.length > 0 && !categoryFilters.includes(row.category)) return false;
    if (statusFilters.length > 0 && !statusFilters.includes(row.status)) return false;
    if (departmentFilters.length > 0 && !departmentFilters.includes(row.department)) return false;
    if (currencyFilters.length > 0 && !currencyFilters.includes(row.currency)) return false;
    if (purposeFilters.length > 0 && !purposeFilters.includes(row.purpose_type)) return false;
    if (amountMin !== '' && row.amount_inr < Number(amountMin)) return false;
    if (amountMax !== '' && row.amount_inr > Number(amountMax)) return false;
    if (dateFrom && row.txn_date < dateFrom) return false;
    if (dateTo && row.txn_date > dateTo) return false;
    return true;
  });

  // ── Sorting ───────────────────────────────────────────────────────────────
  const sortedData = [...filteredData].sort((a, b) => {
    let vA = a[sortCol], vB = b[sortCol];
    if (vA == null) return 1;
    if (vB == null) return -1;
    if (typeof vA === 'string') vA = vA.toLowerCase();
    if (typeof vB === 'string') vB = vB.toLowerCase();
    if (vA < vB) return sortAsc ? -1 : 1;
    if (vA > vB) return sortAsc ? 1 : -1;
    return 0;
  });

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalItems = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const startIdx = (page - 1) * itemsPerPage;
  const endIdx = Math.min(startIdx + itemsPerPage, totalItems);
  const pageData = sortedData.slice(startIdx, endIdx);

  const getSortIcon = (col: string) => {
    if (sortCol !== col) return <ArrowUpDown className='w-3 h-3 opacity-30 group-hover:opacity-60 transition-opacity' />;
    return sortAsc ? <ArrowUp className='w-3 h-3 text-indigo-400' /> : <ArrowDown className='w-3 h-3 text-indigo-400' />;
  };

  // ── Stats bar for filtered view ───────────────────────────────────────────
  const filteredTotal = filteredData.reduce((sum, r) => sum + (r.amount_inr || 0), 0);

  return (
    <div className='space-y-3'>

      {/* ── Primary Search + Quick Controls ──────────────────────────────── */}
      <div className='flex flex-wrap items-center gap-3 bg-[#0A0D16]/60 p-3.5 rounded-2xl border border-borderDark/50'>
        {/* Search */}
        <div className='relative flex-1 min-w-[200px]'>
          <Search className='absolute left-3.5 top-2.5 w-3.5 h-3.5 text-slate-500' />
          <input
            type='text'
            className='w-full bg-[#080B15] border border-borderDark rounded-xl py-2 pl-10 pr-9 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 transition-all'
            placeholder='Search vendor, category, department...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className='absolute right-3 top-2.5 text-slate-500 hover:text-slate-300'>
              <X className='w-3.5 h-3.5' />
            </button>
          )}
        </div>

        {/* Amount Range */}
        <div className='flex items-center gap-2 shrink-0'>
          <input
            type='number'
            className='w-32 bg-[#080B15] border border-borderDark rounded-xl py-2 px-3 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 transition-all'
            placeholder='Min ₹'
            value={amountMin}
            onChange={e => setAmountFilters(e.target.value !== '' ? Number(e.target.value) : '', amountMax)}
          />
          <span className='text-slate-600 text-xs'>—</span>
          <input
            type='number'
            className='w-32 bg-[#080B15] border border-borderDark rounded-xl py-2 px-3 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 transition-all'
            placeholder='Max ₹'
            value={amountMax}
            onChange={e => setAmountFilters(amountMin, e.target.value !== '' ? Number(e.target.value) : '')}
          />
        </div>

        {/* Date Range */}
        <div className='flex items-center gap-2 shrink-0'>
          <Calendar className='w-3.5 h-3.5 text-slate-500 shrink-0' />
          <input
            type='date'
            className='bg-[#080B15] border border-borderDark rounded-xl py-2 px-3 text-xs text-slate-300 outline-none focus:border-indigo-500/60 transition-all'
            value={dateFrom}
            onChange={e => setDateRange(e.target.value, dateTo)}
          />
          <span className='text-slate-600 text-xs'>to</span>
          <input
            type='date'
            className='bg-[#080B15] border border-borderDark rounded-xl py-2 px-3 text-xs text-slate-300 outline-none focus:border-indigo-500/60 transition-all'
            value={dateTo}
            onChange={e => setDateRange(dateFrom, e.target.value)}
          />
        </div>

        {/* Advanced filters toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all shrink-0 ${
            showAdvanced || activeFilterCount > 0
              ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-400'
              : 'bg-[#0D1322] border-borderDark text-slate-400 hover:text-slate-200'
          }`}
        >
          <SlidersHorizontal className='w-3.5 h-3.5' />
          Filters
          {activeFilterCount > 0 && (
            <span className='ml-0.5 px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-3xs font-extrabold min-w-[1.1rem] text-center'>
              {activeFilterCount}
            </span>
          )}
          {showAdvanced ? <ChevronUp className='w-3 h-3' /> : <ChevronDown className='w-3 h-3' />}
        </button>

        {/* Clear All */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className='flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-xl transition-all border border-rose-500/20 shrink-0'
          >
            <X className='w-3.5 h-3.5' />
            Clear All
          </button>
        )}
      </div>

      {/* ── Advanced Filters Panel ────────────────────────────────────────── */}
      {showAdvanced && (
        <div className='p-4 rounded-2xl border border-borderDark/40 bg-[#0A0D16]/30 space-y-4 animate-fadeIn'>

          {/* Category */}
          {uniqueCategories.length > 0 && (
            <div className='flex items-start gap-3 flex-wrap'>
              <span className='text-3xs font-extrabold uppercase text-slate-500 tracking-wider w-20 shrink-0 pt-1'>Category</span>
              <div className='flex flex-wrap gap-1.5'>
                {uniqueCategories.map(cat => (
                  <FilterPill key={cat} label={cat} active={categoryFilters.includes(cat)} onClick={() => toggleCategoryFilter(cat)} />
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          {uniqueStatuses.length > 0 && (
            <div className='flex items-start gap-3 flex-wrap border-t border-borderDark/30 pt-3'>
              <span className='text-3xs font-extrabold uppercase text-slate-500 tracking-wider w-20 shrink-0 pt-1'>Status</span>
              <div className='flex flex-wrap gap-1.5'>
                {uniqueStatuses.map(s => (
                  <FilterPill key={s} label={s} active={statusFilters.includes(s)} onClick={() => toggleStatusFilter(s)} />
                ))}
              </div>
            </div>
          )}

          {/* Department */}
          {uniqueDepartments.length > 0 && (
            <div className='flex items-start gap-3 flex-wrap border-t border-borderDark/30 pt-3'>
              <span className='text-3xs font-extrabold uppercase text-slate-500 tracking-wider w-20 shrink-0 pt-1'>Dept</span>
              <div className='flex flex-wrap gap-1.5'>
                {uniqueDepartments.map(d => (
                  <FilterPill key={d} label={d} active={departmentFilters.includes(d)} onClick={() => toggleDepartmentFilter(d)} />
                ))}
              </div>
            </div>
          )}

          {/* Currency + Purpose */}
          <div className='flex flex-wrap gap-6 border-t border-borderDark/30 pt-3'>
            {uniqueCurrencies.length > 0 && (
              <div className='flex items-center gap-3 flex-wrap'>
                <span className='text-3xs font-extrabold uppercase text-slate-500 tracking-wider'>Currency</span>
                <div className='flex flex-wrap gap-1.5'>
                  {uniqueCurrencies.map(c => (
                    <FilterPill key={c} label={c} active={currencyFilters.includes(c)} onClick={() => toggleCurrencyFilter(c)} />
                  ))}
                </div>
              </div>
            )}
            {uniquePurposes.length > 0 && (
              <div className='flex items-center gap-3 flex-wrap'>
                <span className='text-3xs font-extrabold uppercase text-slate-500 tracking-wider'>Purpose</span>
                <div className='flex flex-wrap gap-1.5'>
                  {uniquePurposes.map(p => (
                    <FilterPill key={p} label={p} active={purposeFilters.includes(p)} onClick={() => togglePurposeFilter(p)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Results Summary Bar ───────────────────────────────────────────── */}
      <div className='flex items-center justify-between px-1'>
        <div className='flex items-center gap-3 text-3xs text-slate-500'>
          <span>
            <span className='text-slate-300 font-bold'>{totalItems}</span> of{' '}
            <span className='text-slate-400'>{data.length}</span> transactions
          </span>
          {activeFilterCount > 0 && (
            <span className='text-indigo-400'>
              · Filtered total: <span className='font-bold'>₹{filteredTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <div className='flex gap-1.5 flex-wrap justify-end max-w-lg'>
            {categoryFilters.map(f => (
              <span key={f} className='flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-3xs font-semibold'>
                {f} <button onClick={() => toggleCategoryFilter(f)}><X className='w-2.5 h-2.5' /></button>
              </span>
            ))}
            {statusFilters.map(f => (
              <span key={f} className='flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-3xs font-semibold'>
                {f} <button onClick={() => toggleStatusFilter(f)}><X className='w-2.5 h-2.5' /></button>
              </span>
            ))}
            {departmentFilters.map(f => (
              <span key={f} className='flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-3xs font-semibold'>
                {f} <button onClick={() => toggleDepartmentFilter(f)}><X className='w-2.5 h-2.5' /></button>
              </span>
            ))}
            {currencyFilters.map(f => (
              <span key={f} className='flex items-center gap-1 px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-full text-3xs font-semibold'>
                {f} <button onClick={() => toggleCurrencyFilter(f)}><X className='w-2.5 h-2.5' /></button>
              </span>
            ))}
            {purposeFilters.map(f => (
              <span key={f} className='flex items-center gap-1 px-2 py-0.5 bg-pink-500/10 border border-pink-500/20 text-pink-400 rounded-full text-3xs font-semibold'>
                {f} <button onClick={() => togglePurposeFilter(f)}><X className='w-2.5 h-2.5' /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Main Data Table ───────────────────────────────────────────────── */}
      <div className='overflow-x-auto rounded-2xl border border-borderDark bg-[#0B0F1A]/40'>
        <table className='w-full text-left text-xs border-collapse'>
          <thead>
            <tr className='bg-[#0A0D16] border-b border-borderDark tracking-wider text-3xs uppercase text-slate-500 font-extrabold select-none'>
              {[
                { key: 'txn_date',    label: 'Date' },
                { key: 'vendor',      label: 'Vendor' },
                { key: 'amount_inr',  label: 'Amount (INR)' },
                { key: 'currency',    label: 'Currency' },
                { key: 'category',    label: 'Category' },
                { key: 'department',  label: 'Dept' },
                { key: 'purpose_type',label: 'Purpose' },
                { key: 'status',      label: 'Status' },
              ].map(h => (
                <th
                  key={h.key}
                  onClick={() => setSorting(h.key)}
                  className='p-3.5 hover:bg-[#12192A]/60 transition-colors cursor-pointer group whitespace-nowrap'
                >
                  <div className='flex items-center gap-1.5'>
                    <span>{h.label}</span>
                    {getSortIcon(h.key)}
                  </div>
                </th>
              ))}
              {customKeys.map(key => (
                <th
                  key={key}
                  onClick={() => setSorting(key)}
                  className='p-3.5 hover:bg-[#12192A]/60 transition-colors cursor-pointer group text-purple-400 font-extrabold whitespace-nowrap'
                >
                  <div className='flex items-center gap-1.5'>
                    <span>{key.replace(/_/g, ' ').toUpperCase()}</span>
                    {getSortIcon(key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={8 + customKeys.length} className='p-12 text-center text-slate-500 font-medium'>
                  No transactions match the selected filters.
                </td>
              </tr>
            ) : (
              pageData.map((row: ExpenseRow, i) => (
                <tr key={i} className='border-b border-borderDark/40 table-row-hover transition-colors'>
                  <td className='p-3.5 font-mono text-slate-400 text-3xs whitespace-nowrap'>{row.txn_date || '—'}</td>
                  <td className='p-3.5 font-bold text-white whitespace-nowrap max-w-[160px] truncate'>{row.vendor || '—'}</td>
                  <td className='p-3.5 font-mono text-slate-200 font-semibold whitespace-nowrap'>
                    ₹{(row.amount_inr ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className='p-3.5'>
                    <span className='px-2 py-0.5 rounded text-3xs font-bold bg-cyan-500/8 text-cyan-400 border border-cyan-500/15'>
                      {row.currency || '—'}
                    </span>
                  </td>
                  <td className='p-3.5 text-indigo-300 font-medium whitespace-nowrap text-xs'>{row.category || '—'}</td>
                  <td className='p-3.5 text-slate-400 whitespace-nowrap text-3xs'>{row.department || '—'}</td>
                  <td className='p-3.5'>
                    {row.purpose_type && (
                      <span className={`px-2 py-0.5 rounded text-3xs font-bold ${getPurposeBadge(row.purpose_type)}`}>
                        {row.purpose_type}
                      </span>
                    )}
                  </td>
                  <td className='p-3.5 whitespace-nowrap'>
                    <span className={`px-2.5 py-1 rounded-full text-3xs font-extrabold tracking-wider ${getStatusBadge(row.status)}`}>
                      {row.status || 'Normal'}
                    </span>
                  </td>
                  {customKeys.map(key => (
                    <td key={key} className='p-3.5 text-slate-300 font-mono text-3xs whitespace-nowrap'>
                      {row[key] != null ? String(row[key]) : '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination Footer ─────────────────────────────────────────────── */}
      <div className='flex flex-wrap items-center justify-between gap-4 bg-[#0A0D16]/30 px-4 py-3 rounded-xl border border-borderDark/40 text-xs'>
        <div className='text-slate-500 font-medium text-3xs'>
          Showing <span className='text-slate-300 font-bold'>{totalItems > 0 ? startIdx + 1 : 0}</span>–
          <span className='text-slate-300 font-bold'>{endIdx}</span> of{' '}
          <span className='text-slate-300 font-bold'>{totalItems}</span>
        </div>

        <div className='flex items-center gap-4'>
          {/* Page Size */}
          <div className='flex items-center gap-2'>
            <span className='text-slate-500 text-3xs'>Rows:</span>
            <select
              value={itemsPerPage}
              onChange={e => setItemsPerPage(Number(e.target.value))}
              className='bg-[#080B15] border border-borderDark rounded-lg px-2 py-1 text-slate-300 text-3xs outline-none focus:border-indigo-500/50'
            >
              {[10, 25, 50, 100].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Page Nav */}
          <div className='flex items-center gap-1.5'>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={page === 1}
              className='px-2 py-1 bg-[#0D1322] border border-borderDark rounded-lg text-slate-400 hover:text-slate-200 hover:border-indigo-500/20 disabled:opacity-30 transition-colors text-3xs'
            >
              «
            </button>
            <button
              onClick={() => setCurrentPage(page - 1)}
              disabled={page === 1}
              className='p-1.5 bg-[#0D1322] border border-borderDark rounded-lg text-slate-400 hover:text-slate-200 hover:border-indigo-500/20 disabled:opacity-30 transition-colors'
            >
              <ChevronLeft className='w-3.5 h-3.5' />
            </button>
            <div className='text-slate-400 font-medium px-2 text-3xs'>
              Page <span className='text-white font-bold'>{page}</span> / <span className='text-slate-500'>{totalPages}</span>
            </div>
            <button
              onClick={() => setCurrentPage(page + 1)}
              disabled={page === totalPages}
              className='p-1.5 bg-[#0D1322] border border-borderDark rounded-lg text-slate-400 hover:text-slate-200 hover:border-indigo-500/20 disabled:opacity-30 transition-colors'
            >
              <ChevronRight className='w-3.5 h-3.5' />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={page === totalPages}
              className='px-2 py-1 bg-[#0D1322] border border-borderDark rounded-lg text-slate-400 hover:text-slate-200 hover:border-indigo-500/20 disabled:opacity-30 transition-colors text-3xs'
            >
              »
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
