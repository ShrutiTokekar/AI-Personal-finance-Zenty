// frontend/src/components/Budget/EditBudgetModal.tsx
import { useState } from 'react';
import { X, Edit2 } from 'lucide-react';
import { budgetAPI, Budget } from '../../services/api';

interface EditBudgetModalProps {
  budget: Budget;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditBudgetModal({ budget, onClose, onSuccess }: EditBudgetModalProps) {
  const [monthlyLimit, setMonthlyLimit] = useState(budget.monthly_limit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (monthlyLimit <= 0) {
      setError('Please enter a valid budget amount');
      return;
    }

    try {
      setSubmitting(true);
      await budgetAPI.update(budget.id, monthlyLimit);
      onSuccess();
    } catch (error) {
      console.error('Failed to update budget:', error);
      setError('Failed to update budget. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Edit2 className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Edit Budget</h2>
              <p className="text-sm text-gray-600 capitalize">{budget.category}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly Budget Limit ($) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={monthlyLimit || ''}
              onChange={(e) => setMonthlyLimit(parseFloat(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="500.00"
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-700">Current spending:</p>
            <p className="text-lg font-bold text-gray-900 mt-1">
              ${budget.current_spent.toFixed(2)}
            </p>
            {monthlyLimit > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {((budget.current_spent / monthlyLimit) * 100).toFixed(1)}% of new budget
              </p>
            )}
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Updating...' : 'Update Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}