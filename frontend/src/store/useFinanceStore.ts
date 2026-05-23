import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const safeLocalStorage = {
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // ignore
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // ignore
    }
  }
};

export interface ExpenseRow {
  raw_row_index: number;
  txn_date: string;
  vendor: string;
  amount_raw: string;
  amount_inr: number;
  currency: string;
  category: string;
  department: string;
  status: string;
  purpose_type: string;
  [key: string]: any;
}

export interface QualityIssue {
  row: number;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  field: string;
  value: string;
  issue: string;
}

export interface ChatMessage {
  sender: 'user' | 'copilot';
  text: string;
  timestamp: string;
}

interface FinanceState {
  data: ExpenseRow[];
  rawBackup: ExpenseRow[];
  metrics: any;
  qualityIssues: QualityIssue[];
  isUploading: boolean;
  isLoading: boolean;
  activeTab: 'Upload' | 'Dashboard' | 'Transactions' | 'Issues Log' | 'Downloads' | 'About Project' | 'Quick Start';

  // Filter & Pagination State
  searchTerm: string;
  sortCol: string;
  sortAsc: boolean;
  categoryFilters: string[];
  statusFilters: string[];
  departmentFilters: string[];
  currencyFilters: string[];
  purposeFilters: string[];
  amountMin: number | '';
  amountMax: number | '';
  dateFrom: string;
  dateTo: string;
  currentPage: number;
  itemsPerPage: number;

  // Chat State
  chatHistory: ChatMessage[];

  // Actions
  setData: (data: ExpenseRow[]) => void;
  setMetrics: (metrics: any) => void;
  setQualityIssues: (issues: QualityIssue[]) => void;
  setUploading: (val: boolean) => void;
  setLoading: (val: boolean) => void;
  setActiveTab: (tab: 'Upload' | 'Dashboard' | 'Transactions' | 'Issues Log' | 'Downloads' | 'About Project' | 'Quick Start') => void;

  setSearchTerm: (term: string) => void;
  setSorting: (col: string) => void;
  toggleCategoryFilter: (category: string) => void;
  toggleStatusFilter: (status: string) => void;
  toggleDepartmentFilter: (dept: string) => void;
  toggleCurrencyFilter: (currency: string) => void;
  togglePurposeFilter: (purpose: string) => void;
  setAmountFilters: (min: number | '', max: number | '') => void;
  setDateRange: (from: string, to: string) => void;
  setCurrentPage: (page: number) => void;
  setItemsPerPage: (items: number) => void;
  clearFilters: () => void;

  addChatMessage: (msg: Omit<ChatMessage, 'timestamp'>) => void;
  clearChatHistory: () => void;

  loadLedgerData: (data: ExpenseRow[], metrics: any, issues: QualityIssue[]) => void;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  data: [],
  rawBackup: [],
  metrics: null,
  qualityIssues: [],
  isUploading: false,
  isLoading: false,
  activeTab: 'Upload',

  searchTerm: '',
  sortCol: 'txn_date',
  sortAsc: true,
  categoryFilters: [],
  statusFilters: [],
  departmentFilters: [],
  currencyFilters: [],
  purposeFilters: [],
  amountMin: '',
  amountMax: '',
  dateFrom: '',
  dateTo: '',
  currentPage: 1,
  itemsPerPage: 10,

  chatHistory: [
    {
      sender: 'copilot',
      text: 'Welcome to the AI-Native ERP Control Plane. Upload your general ledger in the "Upload" tab to inspect transactions, clean duplicates, and audit anomalous entries. You can also type natural language commands directly here, like "Flag all expenses over ₹50,000 as High Risk".',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ],

  setData: (data) => set({ data, currentPage: 1 }),
  setMetrics: (metrics) => set({ metrics }),
  setQualityIssues: (qualityIssues) => set({ qualityIssues }),
  setUploading: (val) => set({ isUploading: val }),
  setLoading: (val) => set({ isLoading: val }),
  setActiveTab: (activeTab) => set({ activeTab }),

  setSearchTerm: (searchTerm) => set({ searchTerm, currentPage: 1 }),

  setSorting: (col) => {
    const { sortCol, sortAsc } = get();
    if (sortCol === col) {
      set({ sortAsc: !sortAsc });
    } else {
      set({ sortCol: col, sortAsc: true });
    }
  },

  toggleCategoryFilter: (category) => {
    const filters = get().categoryFilters;
    set({ categoryFilters: filters.includes(category) ? filters.filter(c => c !== category) : [...filters, category], currentPage: 1 });
  },

  toggleStatusFilter: (status) => {
    const filters = get().statusFilters;
    set({ statusFilters: filters.includes(status) ? filters.filter(s => s !== status) : [...filters, status], currentPage: 1 });
  },

  toggleDepartmentFilter: (dept) => {
    const filters = get().departmentFilters;
    set({ departmentFilters: filters.includes(dept) ? filters.filter(d => d !== dept) : [...filters, dept], currentPage: 1 });
  },

  toggleCurrencyFilter: (currency) => {
    const filters = get().currencyFilters;
    set({ currencyFilters: filters.includes(currency) ? filters.filter(c => c !== currency) : [...filters, currency], currentPage: 1 });
  },

  togglePurposeFilter: (purpose) => {
    const filters = get().purposeFilters;
    set({ purposeFilters: filters.includes(purpose) ? filters.filter(p => p !== purpose) : [...filters, purpose], currentPage: 1 });
  },

  setAmountFilters: (amountMin, amountMax) => set({ amountMin, amountMax, currentPage: 1 }),

  setDateRange: (dateFrom, dateTo) => set({ dateFrom, dateTo, currentPage: 1 }),

  setCurrentPage: (currentPage) => set({ currentPage }),
  setItemsPerPage: (itemsPerPage) => set({ itemsPerPage, currentPage: 1 }),

  clearFilters: () => set({
    searchTerm: '',
    categoryFilters: [],
    statusFilters: [],
    departmentFilters: [],
    currencyFilters: [],
    purposeFilters: [],
    amountMin: '',
    amountMax: '',
    dateFrom: '',
    dateTo: '',
    currentPage: 1
  }),

  addChatMessage: (msg) => {
    const newMsg: ChatMessage = { ...msg, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    set((state) => ({ chatHistory: [...state.chatHistory, newMsg] }));
  },

  clearChatHistory: () => set({
    chatHistory: [{
      sender: 'copilot',
      text: 'System ledger chat restarted. How can I help you audit your company expenses today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]
  }),

  loadLedgerData: (data, metrics, qualityIssues) => set({ data, metrics, qualityIssues, currentPage: 1 })
}));
