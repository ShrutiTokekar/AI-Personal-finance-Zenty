// frontend/src/components/Budget/BudgetPage.tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, Plus, Edit2, Trash2, AlertCircle, 
  TrendingUp, TrendingDown, PieChart, CheckCircle 
} from 'lucide-react';
import { budgetAPI, Budget, BudgetSummary } from '../../services/api';
import CreateBudgetModal from './CreateBudgetModal';
import EditBudgetModal from './EditBudgetModal';

export default function BudgetPage() {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);

  useEffect(() => {
    loadBudgets();
  }, []);

  const loadBudgets = async () => {
    try {
      setLoading(true);
      const response = await budgetAPI.getSummary();
      setSummary(response.data);
    } catch (error) {
      console.error('Failed to load budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this budget?')) return;
    
    try {
      await budgetAPI.delete(id);
      loadBudgets();
    } catch (error) {
      console.error('Failed to delete budget:', error);
    }
  };

  const handleEdit = (budget: Budget) => {
    setSelectedBudget(budget);
    setShowEditModal(true);
  };

  const getStatusColor = (remaining: number, limit: number) => {
    const percentRemaining = (remaining / limit) * 100;
    if (percentRemaining > 50) return 'text-green-600 bg-green-50';
    if (percentRemaining > 25) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getProgressColor = (spent: number, limit: number) => {
    const percentSpent = (spent / limit) * 100;
    if (percentSpent < 50) return 'bg-green-500';
    if (percentSpent < 75) return 'bg-yellow-500';
    if (percentSpent < 100) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const categoryIcons: Record<string, string> = {
    groceries: '🛒',
    food: '🍔',
    rent: '🏠',
    utilities: '💡',
    transport: '🚗',
    entertainment: '🎮',
    shopping: '🛍️',
    healthcare: '⚕️',
    other: '📦',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Budget Management</h1>
          <p className="mt-2 text-gray-600">Track and manage your spending limits</p>
        </div>
        <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>Add Budget</span>
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-primary-50 rounded-xl p-6 border border-primary-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Total Budget</h3>
              <PieChart className="h-6 w-6 text-primary-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ${summary.total_budget.toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Across {summary.budgets.length} categories
            </p>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-6 border border-red-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Total Spent</h3>
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ${summary.total_spent.toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {((summary.total_spent / summary.total_budget) * 100).toFixed(1)}% of budget
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Remaining</h3>
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ${summary.total_remaining.toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Available to spend
            </p>
          </div>
        </div>
      )}

      {/* Budgets List */}
      {!summary || summary.budgets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Budgets Yet</h3>
          <p className="text-gray-600 mb-4">Start managing your spending by creating budgets</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Create Your First Budget</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence>
            {summary.budgets.map((budget, index) => {
              const percentSpent = (budget.current_spent / budget.monthly_limit) * 100;
              const isOverBudget = percentSpent > 100;

              return (
                <motion.div
                  key={budget.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.1 }}
                  className={`bg-white rounded-xl shadow-sm border p-6 ${
                    isOverBudget ? 'border-red-300' : 'border-gray-100'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-3xl">{categoryIcons[budget.category] || '📦'}</span>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 capitalize">
                          {budget.category}
                        </h3>
                        <p className="text-sm text-gray-500">
                          ${budget.current_spent.toFixed(2)} / ${budget.monthly_limit.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(budget)}
                        className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(budget.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-3">
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(percentSpent, 100)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className={`h-3 rounded-full ${getProgressColor(budget.current_spent, budget.monthly_limit)}`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-gray-700">
                        {percentSpent.toFixed(1)}% used
                      </span>
                      <span className={`font-semibold ${
                        budget.remaining >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {budget.remaining >= 0 ? '' : '-'}$
                        {Math.abs(budget.remaining).toFixed(2)} remaining
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mt-4">
                    {isOverBudget ? (
                      <div className="flex items-center space-x-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <span className="text-sm font-medium text-red-700">
                          Over budget by ${(budget.current_spent - budget.monthly_limit).toFixed(2)}
                        </span>
                      </div>
                    ) : percentSpent > 75 ? (
                      <div className="flex items-center space-x-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-700">
                          Warning: {(100 - percentSpent).toFixed(1)}% remaining
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium text-green-700">
                          On track!
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateBudgetModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadBudgets();
          }}
        />
      )}

      {showEditModal && selectedBudget && (
        <EditBudgetModal
          budget={selectedBudget}
          onClose={() => {
            setShowEditModal(false);
            setSelectedBudget(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedBudget(null);
            loadBudgets();
          }}
        />
      )}
    </div>
  );
}