// frontend/src/services/api.ts
import axios, { AxiosError } from 'axios';

// Frontend and API are served from the same origin (/api), so session cookies
// stay first-party, httpOnly and SameSite=Strict. In dev, Vite proxies /api.
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'zenty',
  },
});

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

// Attach the CSRF token (double-submit cookie) to every request.
// Nothing about requests or financial data is logged to the console.
api.interceptors.request.use((config) => {
  const csrf = readCookie('zenty_csrf');
  if (csrf) config.headers.set('X-CSRF-Token', csrf);
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401 && !error.config?.url?.startsWith('/auth/')) {
      window.dispatchEvent(new Event('zenty:signed-out'));
    }
    return Promise.reject(error);
  }
);

/** Human-friendly message from an API error. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = err as AxiosError<{ detail?: string }>;
  if (e?.response?.data?.detail && typeof e.response.data.detail === 'string') return e.response.data.detail;
  if (e?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (e?.message === 'Network Error') return "Can't reach Zenty right now. Check your connection.";
  return fallback;
}

export interface User {
  id: number;
  email: string;
  name: string;
  email_verified: boolean;
  has_password: boolean;
  google_linked: boolean;
  stock_alerts: boolean;
  stock_alert_threshold: number;
  created_at: string;
  phone_masked?: string | null;
  phone_verified?: boolean;
  mfa_enabled?: boolean;
}

export type LoginResult = { user: User } | { mfa_required: true; mfa_ticket: string; phone_masked: string | null };

export interface PublicConfig {
  google_client_id: string | null;
  bank_linking: boolean;
  email_enabled?: boolean;
  sms_enabled?: boolean;
}

export const authAPI = {
  config: () => api.get<PublicConfig>('/auth/config'),
  me: () => api.get<{ user: User }>('/auth/me'),
  signup: (name: string, email: string, password: string, confirm_password: string, phone: string) =>
    api.post<{ user: User; phone_verification_required: boolean }>('/auth/signup', { name, email, password, confirm_password, phone }),
  login: (email: string, password: string) => api.post<LoginResult>('/auth/login', { email, password }),
  mfaVerify: (ticket: string, code: string) => api.post<{ user: User }>('/auth/mfa/verify', { ticket, code }),
  mfaResend: (ticket: string) => api.post('/auth/mfa/resend', { ticket }),
  phoneVerify: (code: string) => api.post<{ user: User }>('/auth/phone/verify', { code }),
  phoneResend: () => api.post('/auth/phone/resend'),
  google: (credential: string) => api.post<{ user: User; new_user: boolean }>('/auth/google', { credential }),
  logout: () => api.post('/auth/logout'),
  logoutEverywhere: () => api.post('/auth/logout-everywhere'),
  verifyEmail: (token: string) => api.post('/auth/verify-email', { token }),
  resendVerification: () => api.post('/auth/resend-verification'),
  forgotPassword: (email: string) => api.post<{ message: string }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post('/auth/reset-password', { token, password }),
};

export const accountAPI = {
  updateProfile: (data: Partial<Pick<User, 'name' | 'stock_alerts' | 'stock_alert_threshold'>>) =>
    api.patch<{ user: User }>('/account/profile', data),
  changePassword: (current_password: string | null, new_password: string) =>
    api.post('/account/password', { current_password, new_password }),
  exportData: () => api.get('/account/export'),
  deleteAccount: (confirm: string, password: string | null) =>
    api.delete('/account', { data: { confirm, password } }),
};

export interface BankAccount {
  id: number;
  item_id: number;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  kind?: AccountKind;
  current_balance: number | null;
  available_balance: number | null;
  currency: string;
}

export interface BankItem {
  id: number;
  institution: string;
  last_synced: string | null;
  accounts: BankAccount[];
}

export const bankAPI = {
  linkToken: () => api.post<{ link_token: string }>('/bank/link-token'),
  exchange: (public_token: string) =>
    api.post<{ success: boolean; institution: string; imported: number }>('/bank/exchange', { public_token }),
  accounts: () => api.get<{ items: BankItem[]; total_assets: number; total_debt: number }>('/bank/accounts'),
  sync: () => api.post<{ success: boolean; imported: number; errors: { institution: string; error: string }[] }>('/bank/sync'),
  unlink: (itemId: number) => api.delete(`/bank/items/${itemId}`),
};

export interface Transaction {
  id?: number;
  amount: number;
  category: string;
  description?: string;
  date?: string;
  type: 'income' | 'expense';
  source?: 'manual' | 'bank';
  account?: { id: number; name: string; mask: string | null; kind: AccountKind } | null;
}

export type AccountKind = 'checking' | 'savings' | 'credit' | 'loan' | 'investment' | 'other';

export interface Summary {
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  expense_change: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
}

export interface Trend {
  month: string;
  amount: number;
}

export interface SavingsGoal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  remaining: number;
  progress: number;
  deadline?: string;
  description?: string;
  created_at: string;
  completed: boolean;
}

export interface SavingsTransaction {
  id: number;
  goal_id: number;
  amount: number;
  date: string;
  description?: string;
}

export interface Stock{
  id: number;
  symbol: string;
  name?: string;
  shares: number;
  purchase_price: number;
  total_cost: number;
  purchase_date: string;
  notes?: string;
}

export interface StockPrice {
  symbol: string;
  name: string;
  current_price: number;
  previous_close: number;
  price_change: number;
  price_change_percent: number;
  day_high?: number;
  day_low?: number;
  volume?: number;
  market_cap?: number;
  pe_ratio?: number;
  fifty_two_week_high?: number;
  fifty_two_week_low?: number;
  currency: string;
  exchange?: string;
  last_updated: string;
}

export interface StockHistory {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Budget {
  id: number;
  category: string;
  monthly_limit: number;
  current_spent: number;
  remaining: number;
}

export interface BudgetSummary {
  total_budget: number;
  total_spent: number;
  total_remaining: number;
  budgets: Budget[];
}

export const budgetAPI = {
  getAll: () => api.get<{ budgets: Budget[] }>('/budgets'),
  create: (category: string, monthly_limit: number) => 
    api.post('/budgets', { category, monthly_limit }),
  update: (id: number, monthly_limit: number) => 
    api.put(`/budgets/${id}`, { monthly_limit }),
  delete: (id: number) => api.delete(`/budgets/${id}`),
  getSummary: () => api.get<BudgetSummary>('/budgets/summary'),
};

export const savingsAPI = {
  getGoals: (includeCompleted: boolean = false) =>
    api.get<{ goals: SavingsGoal[]}>(`/savings/goals?include_completed=${includeCompleted}`),
  createGoal:(goal: Partial<SavingsGoal>) =>
    api.post('/savings/goals', goal),
  contributeToGoal: (goalId: number, amount: number, description?: string) =>
    api.post(`/savings/goals/${goalId}/contribute`, { amount, description }),
  getGoalTransactions: (goalId: number) =>
    api.get<{ transactions: SavingsTransaction[] }>(`/savings/goals/${goalId}/transactions`),
  deleteGoal: (goalId: number) =>
    api.delete(`/savings/goals/${goalId}`),
};
export const stocksAPI = {
  getAll: () => api.get<{ stocks: Stock[] }>('/stocks'),
  add: (stock: Partial<Stock>) => api.post('/stocks', stock),
  delete: (id: number) => api.delete(`/stocks/${id}`),
  getPortfolio: () => api.get('/stocks/portfolio'),
  
  // New methods for real-time prices
  getPrice: (symbol: string) => 
    api.get<StockPrice>(`/stocks/price/${encodeURIComponent(symbol)}`),
  
  getPrices: (symbols: string[]) => 
    api.post<{ prices: Record<string, StockPrice> }>('/stocks/prices', symbols),
  
  getHistory: (symbol: string, period: string = '1mo') => 
    api.get<{ symbol: string; period: string; history: StockHistory[] }>(
      `/stocks/history/${symbol}?period=${period}`
    ),
  
  search: (query: string) => 
    api.get<{ results: Array<{ symbol: string; name: string; exchange: string; type: string }> }>(
      `/stocks/search?query=${encodeURIComponent(query)}`
    ),
  
  validate: (symbol: string) =>
    api.get<{ symbol: string; valid: boolean }>(`/stocks/validate/${encodeURIComponent(symbol)}`),
};

export const transactionAPI = {
  getAll: () => api.get<{ transactions: Transaction[] }>('/transactions'),
  create: (transaction: Transaction) => api.post('/transactions', transaction),
  delete: (id: number) => api.delete(`/transactions/${id}`),
};

export const analyticsAPI = {
  getSummary: () => api.get<Summary>('/analytics/summary'),
  getTrends: () => api.get<{ trends: Trend[] }>('/analytics/trends'),
  getCategoryBreakdown: () => api.get<{ breakdown: CategoryBreakdown[] }>('/analytics/category-breakdown'),
};

export interface ZenFactor { key: string; label: string; points: number; max: number; tip: string }
export interface Overview {
  summary: Summary;
  zen: { score: number; label: string; factors: ZenFactor[] };
  safe_to_spend: { daily: number; remaining: number; days_left: number; basis: string };
  daily: { day: number; amount: number; future: boolean }[];
  trends: Trend[];
  categories: CategoryBreakdown[];
  budgets: Budget[];
  goals: SavingsGoal[];
  recent: Transaction[];
  recurring: { items: { name: string; category: string; amount: number; last_date: string; next_date: string }[]; monthly_total: number };
  net_worth: { cash: number; debt: number; invested: number; total: number; linked_accounts: number };
}

export const overviewAPI = {
  get: () => api.get<Overview>('/overview'),
};

export type AssistantAction =
  | { label: string; kind: 'delete_transaction'; id: number }
  | { label: string; kind: 'apply_budgets'; budgets: { category: string; monthly_limit: number }[] }
  | { label: string; kind: 'dismiss' };

export interface AssistantReply {
  type: 'text' | 'confirm' | 'plan';
  message: string;
  actions?: AssistantAction[];
}

export const chatAPI = {
  sendMessage: (message: string) => api.post<AssistantReply>('/chat', { message }),
};

export const anomaliesAPI = {
  get: () => api.get<{ anomalies: Transaction[] }>('/anomalies'),
};

export const predictionAPI = {
  predictNextMonth: () => api.get('/predict/next-month'),
};

export const adviceAPI = {
  getAdvice: () => api.get<{ advice: string }>('/advice'),
};

export default api;