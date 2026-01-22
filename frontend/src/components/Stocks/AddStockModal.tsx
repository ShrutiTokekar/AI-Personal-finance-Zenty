// frontend/src/components/Stocks/AddStockModal.tsx
import { useState } from 'react';
import { X, TrendingUp, Search, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { stocksAPI } from '../../services/api';

interface AddStockModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddStockModal({ onClose, onSuccess }: AddStockModalProps) {
  const [formData, setFormData] = useState({
    symbol: '',
    name: '',
    shares: 0,
    purchase_price: 0,
    purchase_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [symbolError, setSymbolError] = useState('');
  const [symbolValid, setSymbolValid] = useState(false);

  const popularStocks = [
    { symbol: 'AAPL', name: 'Apple' },
    { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'GOOGL', name: 'Google' },
    { symbol: 'AMZN', name: 'Amazon' },
    { symbol: 'TSLA', name: 'Tesla' },
    { symbol: 'NVDA', name: 'NVIDIA' },
    { symbol: 'META', name: 'Meta' },
    { symbol: 'NFLX', name: 'Netflix' },
  ];

  const validateSymbol = async (symbol: string) => {
    if (!symbol || symbol.length < 1) {
      setSymbolError('');
      setSymbolValid(false);
      return false;
    }
    
    try {
      setValidating(true);
      setSymbolError('');
      setSymbolValid(false);
      
      console.log('Validating symbol:', symbol);

      // Validate symbol
      const validationResponse = await stocksAPI.validate(symbol.toUpperCase());
      console.log('Validation response:', validationResponse);
      
      if (!validationResponse.data.valid) {
        setSymbolError('Invalid stock symbol. Please check and try again.');
        setSymbolValid(false);
        return false;
      }
      
      // Fetch stock info to populate name and current price
      try {
        const priceInfo = await stocksAPI.getPrice(symbol.toUpperCase());
        console.log('Price info response:', priceInfo);

        if (priceInfo.data.name) {
          setFormData(prev => ({ 
            ...prev, 
            name: priceInfo.data.name,
            // Optionally pre-fill with current price
            purchase_price: prev.purchase_price || priceInfo.data.current_price
          }));
        }
        setSymbolValid(true);
        return true;
      } catch (priceError) {
        // Symbol is valid but couldn't fetch price info
        console.error('Price info fetch error:', priceError);
        setSymbolValid(true);
        return true;
      }
    } catch (error: any) {
      console.error('Symbol validation error:', error);

      if (error.message?.includes('Failed to fetch')) {
      setSymbolError('Cannot connect to server. Please check if the backend is running.');
      } else if (error.message?.includes('NetworkError')) {
      setSymbolError('Network error. Please check your internet connection.');
      } else {
      setSymbolError('Unable to validate symbol. Please try again.');
      }
    
      setSymbolValid(false);
      return false;
    } finally {
      setValidating(false);
    }
  };

  const handleSymbolBlur = () => {
    if (formData.symbol && formData.symbol.length >= 1) {
      validateSymbol(formData.symbol);
    }
  };

  const handleSymbolChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setFormData({ ...formData, symbol: upperValue });
    setSymbolError('');
    setSymbolValid(false);
    
    // Clear name if symbol changes
    if (upperValue !== formData.symbol) {
      setFormData(prev => ({ ...prev, symbol: upperValue, name: '' }));
    }
  };

  const handlePopularStockClick = async (stock: { symbol: string; name: string }) => {
    setFormData({ ...formData, symbol: stock.symbol, name: stock.name });
    setSymbolError('');
    await validateSymbol(stock.symbol);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate all fields
    if (!formData.symbol.trim()) {
      setError('Please enter a stock symbol');
      return;
    }

    // Validate symbol if not already validated
    if (!symbolValid) {
      const isValid = await validateSymbol(formData.symbol);
      if (!isValid) {
        setError(symbolError || 'Invalid stock symbol');
        return;
      }
    }

    if (formData.shares <= 0) {
      setError('Please enter a valid number of shares (must be greater than 0)');
      return;
    }

    if (formData.purchase_price <= 0) {
      setError('Please enter a valid purchase price (must be greater than 0)');
      return;
    }

    try {
      setSubmitting(true);
      await stocksAPI.add({
        symbol: formData.symbol.toUpperCase(),
        name: formData.name || undefined,
        shares: formData.shares,
        purchase_price: formData.purchase_price,
        purchase_date: formData.purchase_date,
        notes: formData.notes || undefined,
      });
      onSuccess();
    } catch (error: any) {
      console.error('Failed to add stock:', error);
      setError(error.response?.data?.detail || 'Failed to add stock. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalCost = formData.shares > 0 && formData.purchase_price > 0 
    ? formData.shares * formData.purchase_price 
    : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-primary-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Add Stock</h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Popular Stocks */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Popular Stocks
          </label>
          <div className="grid grid-cols-4 gap-2">
            {popularStocks.map((stock) => (
              <button
                key={stock.symbol}
                type="button"
                onClick={() => handlePopularStockClick(stock)}
                disabled={validating || submitting}
                className={`px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium text-center transition-colors disabled:opacity-50 ${
                  formData.symbol === stock.symbol
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 text-gray-700'
                }`}
              >
                <div className="font-bold">{stock.symbol}</div>
                <div className="text-xs text-gray-500 truncate">{stock.name}</div>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Stock Symbol */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stock Symbol *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={formData.symbol}
                  onChange={(e) => handleSymbolChange(e.target.value)}
                  onBlur={handleSymbolBlur}
                  className={`w-full px-4 py-3 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase ${
                    symbolError 
                      ? 'border-red-500' 
                      : symbolValid 
                      ? 'border-green-500' 
                      : 'border-gray-300'
                  }`}
                  placeholder="AAPL"
                  maxLength={5}
                  disabled={validating || submitting}
                />
                <div className="absolute right-3 top-3">
                  {validating ? (
                    <Loader className="h-5 w-5 text-gray-400 animate-spin" />
                  ) : symbolValid ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : symbolError ? (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <Search className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>
              {validating && (
                <p className="mt-1 text-sm text-gray-500 flex items-center">
                  <Loader className="h-3 w-3 mr-1 animate-spin" />
                  Validating symbol...
                </p>
              )}
              {symbolError && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {symbolError}
                </p>
              )}
              {symbolValid && !validating && (
                <p className="mt-1 text-sm text-green-600 flex items-center">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Valid symbol
                </p>
              )}
            </div>

            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Apple Inc."
                disabled={submitting}
              />
              <p className="mt-1 text-xs text-gray-500">Auto-filled if symbol is valid</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Number of Shares */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Shares *
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                value={formData.shares || ''}
                onChange={(e) => setFormData({ ...formData, shares: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="10"
                disabled={submitting}
              />
            </div>

            {/* Purchase Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purchase Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={formData.purchase_price || ''}
                onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="150.00"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Purchase Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Purchase Date *
            </label>
            <input
              type="date"
              required
              value={formData.purchase_date}
              onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={submitting}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Add notes about this investment..."
              disabled={submitting}
            />
          </div>

          {/* Total Cost Display */}
          {totalCost > 0 && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Total Investment Cost:</p>
                  <p className="text-2xl font-bold text-primary-600 mt-1">
                    ${totalCost.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Cost per share</p>
                  <p className="text-lg font-semibold text-gray-900">
                    ${formData.purchase_price.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || validating}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || validating || !symbolValid}
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {submitting ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <span>Add Stock</span>
              )}
            </button>
          </div>
        </form>

        {/* Info Note */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>💡 Tip:</strong> Stock symbols are validated in real-time using Yahoo Finance. 
            The company name and current price will be auto-filled when you enter a valid symbol.
          </p>
        </div>
      </div>
    </div>
  );
}