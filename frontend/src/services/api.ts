// frontend/src/services/api.ts
import axios from 'axios';


// Try using the full URL instead of relative
const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Add response interceptor to log errors
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', response.config.url, response.status);
    return response;
  },
  (error) => {
    console.error('❌ API Error:');
    console.error('URL:', error.config?.url);
    console.error('Method:', error.config?.method);
    console.error('Data:', error.config?.data);
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
      console.error('Request:', error.request);
    }
    return Promise.reject(error);
  }
);

// Add request interceptor to log requests
api.interceptors.request.use(
  (config) => {
    console.log('🚀 API Request:', config.method?.toUpperCase(), config.url);
    console.log('Data:', config.data);
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

export interface Transaction {
  id?: number;
  amount: number;
  category: string;
  description?: string;
  date?: string;
  type: 'income' | 'expense';
}

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
    api.get<StockPrice>(`/stocks/price/${symbol}`),
  
  getPrices: (symbols: string[]) => 
    api.post<{ prices: Record<string, StockPrice> }>('/stocks/prices', symbols),
  
  getHistory: (symbol: string, period: string = '1mo') => 
    api.get<{ symbol: string; period: string; history: StockHistory[] }>(
      `/stocks/history/${symbol}?period=${period}`
    ),
  
  search: (query: string) => 
    api.get<{ results: Array<{ symbol: string; name: string; exchange: string; type: string }> }>(
      `/stocks/search?query=${query}`
    ),
  
  validate: (symbol: string) => 
    api.get<{ symbol: string; valid: boolean }>(`/stocks/validate/${symbol}`),
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

export const chatAPI = {
  sendMessage: (message: string) => api.post('/chat', { message }),
};

export const predictionAPI = {
  predictNextMonth: () => api.get('/predict/next-month'),
};

export const adviceAPI = {
  getAdvice: () => api.get<{ advice: string }>('/advice'),
};

export default api;