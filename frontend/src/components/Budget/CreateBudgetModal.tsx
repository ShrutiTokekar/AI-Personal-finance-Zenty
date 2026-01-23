// frontend/src/components/Budget/CreateBudgetModal.tsx
import { useState } from 'react';
import { X, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import { budgetAPI } from '../../services/api';

interface CreateBudgetModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const categories = [
  { value: 'groceries', label: 'Groceries', icon: '🛒' },
  { value: 'food', label: 'Food & Dining', icon: '🍔' },
  { value: 'rent', label: 'Rent', icon: '🏠' },
  { value: 'utilities', label: 'Utilities', icon: '💡' },
  { value: 'transport', label: 'Transportation', icon: '🚗' },
  { value: 'entertainment', label: 'Entertainment', icon: '🎮' },
  { value: 'shopping', label: 'Shopping', icon: '🛍️' },
  { value: 'healthcare', label: 'Healthcare', icon: '⚕️' },
  { value: 'other', label: 'Other', icon: '📦' },
];

export default function CreateBudgetModal({ onClose, onSuccess }: CreateBudgetModalProps) {
  const [category, setCategory] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setError('');
    console.log('Form submitted', { category, monthlyLimit });

    if (!category) {
      setError('Please select a category');
      return;
    }

    const limitNum = parseFloat(monthlyLimit);
    if (!monthlyLimit || limitNum <= 0 || isNaN(limitNum)) {
      setError('Please enter a valid budget amount');
      return;
    }

    try {
      setSubmitting(true);
      console.log('Creating budget:', { category, monthly_limit: limitNum });
      
      const response = await budgetAPI.create(category, limitNum);
      console.log('Budget created successfully:', response.data);
      
      setSuccess(true);
      
      // Wait 1.5 seconds to show success, then close and refresh
      setTimeout(() => {
        console.log('Calling onSuccess');
        onSuccess();
      }, 1500);
      
    } catch (error: any) {
      console.error('Failed to create budget:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      setError(
        error.response?.data?.detail || 
        error.message || 
        'Failed to create budget. Please try again.'
      );
      setSubmitting(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Budget Created!</h3>
          <p className="text-gray-600">Your budget has been successfully created.</p>
          <div className="mt-4 h-1 bg-green-200 rounded-full overflow-hidden">
            <div className="h-full bg-green-600 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl p-8 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-primary-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Create Budget</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => {
                    console.log('Category selected:', cat.value);
                    setCategory(cat.value);
                  }}
                  disabled={submitting}
                  className={`px-3 py-3 border rounded-lg text-center transition-colors disabled:opacity-50 ${
                    category === cat.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-2xl mb-1">{cat.icon}</div>
                  <div className="text-xs font-medium">{cat.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly Budget Limit ($) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={monthlyLimit}
              onChange={(e) => {
                console.log('Amount changed:', e.target.value);
                setMonthlyLimit(e.target.value);
              }}
              disabled={submitting}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              placeholder="500.00"
            />
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !category || !monthlyLimit}
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </span>
              ) : (
                'Create Budget'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}