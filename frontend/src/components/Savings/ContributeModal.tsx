// frontend/src/components/Savings/ContributeModal.tsx
import { useState } from 'react';
import { X, DollarSign } from 'lucide-react';
import { savingsAPI, SavingsGoal } from '../../services/api';

interface ContributeModalProps {
  goal: SavingsGoal;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ContributeModal({ goal, onClose, onSuccess }: ContributeModalProps) {
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const quickAmounts = [10, 25, 50, 100];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      setSubmitting(true);
      await savingsAPI.contributeToGoal(goal.id, amount, description || undefined);
      onSuccess();
    } catch (error) {
      console.error('Failed to contribute:', error);
      setError('Failed to add contribution. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{goal.name}</h2>
            <p className="text-sm text-gray-600 mt-1">
              ${goal.current_amount.toFixed(2)} / ${goal.target_amount.toFixed(2)}
            </p>
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
              Amount to Add ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            {quickAmounts.map((quickAmount) => (
              <button
                key={quickAmount}
                type="button"
                onClick={() => setAmount(quickAmount)}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                ${quickAmount}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Note (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Add a note..."
            />
          </div>

          <div className="bg-primary-50 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              After this contribution:
            </p>
            <p className="text-lg font-bold text-primary-600 mt-1">
              ${(goal.current_amount + (amount || 0)).toFixed(2)} / ${goal.target_amount.toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {(((goal.current_amount + (amount || 0)) / goal.target_amount) * 100).toFixed(1)}% Complete
            </p>
          </div>

          <div className="flex space-x-3">
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
              disabled={submitting || !amount}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              <DollarSign className="h-5 w-5" />
              <span>{submitting ? 'Adding...' : 'Add Money'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}