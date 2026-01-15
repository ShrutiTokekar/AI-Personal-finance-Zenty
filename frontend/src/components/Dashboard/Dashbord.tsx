// frontend/src/components/Dashboard/Dashboard.tsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, AlertCircle } from 'lucide-react';
import { analyticsAPI, Summary } from '../../services/api';
import SpendingChart from './SpendingChart';
import CategoryPieChart from './CategoryPieChart';

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const response = await analyticsAPI.getSummary();
      setSummary(response.data);
    } catch (error) {
      console.error('Failed to load summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const stats = [
    {
      name: 'Total Income',
      value: `$${summary?.total_income.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      change: null,
    },
    {
      name: 'Total Expenses',
      value: `$${summary?.total_expenses.toFixed(2) || '0.00'}`,
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      change: summary?.expense_change || 0,
    },
    {
      name: 'Net Savings',
      value: `$${summary?.net_savings.toFixed(2) || '0.00'}`,
      icon: PiggyBank,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      change: null,
    },
    {
      name: 'Savings Rate',
      value: `${summary?.savings_rate.toFixed(1) || '0.0'}%`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      change: null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">Your financial overview at a glance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium">{stat.name}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
                {stat.change !== null && stat.change !== 0 && (
                  <div className="mt-2 flex items-center">
                    <span
                      className={`text-sm font-medium ${
                        stat.change > 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {stat.change > 0 ? '↑' : '↓'} {Math.abs(stat.change).toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-500 ml-2">vs last month</span>
                  </div>
                )}
              </div>
              <div className={`${stat.bgColor} p-3 rounded-lg`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Expense Change Alert */}
      {summary && summary.expense_change > 10 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start space-x-3"
        >
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-yellow-900">Spending Alert</h3>
            <p className="text-sm text-yellow-800 mt-1">
              Your expenses increased by {summary.expense_change.toFixed(1)}% compared to last month.
              Consider reviewing your spending habits.
            </p>
          </div>
        </motion.div>
      )}

      {/* Positive Savings Alert */}
      {summary && summary.savings_rate > 20 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start space-x-3"
        >
          <PiggyBank className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-green-900">Great Job! 🎉</h3>
            <p className="text-sm text-green-800 mt-1">
              You're saving {summary.savings_rate.toFixed(1)}% of your income. Keep up the excellent work!
            </p>
          </div>
        </motion.div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpendingChart />
        <CategoryPieChart />
      </div>
    </div>
  );
}