// frontend/src/components/Stocks/StockDetailsModal.tsx
import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import { stocksAPI, Stock, StockPrice, StockHistory } from '../../services/api';

interface StockDetailsModalProps {
  stock: Stock;
  onClose: () => void;
}

export default function StockDetailsModal({ stock, onClose }: StockDetailsModalProps) {
  const [priceInfo, setPriceInfo] = useState<StockPrice | null>(null);
  const [history, setHistory] = useState<StockHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('1mo');

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [priceResponse, historyResponse] = await Promise.all([
        stocksAPI.getPrice(stock.symbol),
        stocksAPI.getHistory(stock.symbol, period),
      ]);
      
      setPriceInfo(priceResponse.data);
      setHistory(historyResponse.data.history);
    } catch (error) {
      console.error('Failed to load stock details:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{stock.symbol}</h2>
            {priceInfo && (
              <p className="text-gray-600">{priceInfo.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : priceInfo ? (
          <div className="space-y-6">
            {/* Current Price */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Current Price</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${priceInfo.current_price.toFixed(2)}
                </p>
                <div className={`flex items-center mt-1 text-sm ${
                  priceInfo.price_change >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {priceInfo.price_change >= 0 ? (
                    <TrendingUp className="h-4 w-4 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 mr-1" />
                  )}
                  {priceInfo.price_change >= 0 ? '+' : ''}
                  {priceInfo.price_change.toFixed(2)} ({priceInfo.price_change_percent.toFixed(2)}%)
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Day Range</p>
                <p className="text-lg font-semibold text-gray-900">
                  ${priceInfo.day_low?.toFixed(2)} - ${priceInfo.day_high?.toFixed(2)}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">52 Week Range</p>
                <p className="text-lg font-semibold text-gray-900">
                  ${priceInfo.fifty_two_week_low?.toFixed(2)} - ${priceInfo.fifty_two_week_high?.toFixed(2)}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">P/E Ratio</p>
                <p className="text-lg font-semibold text-gray-900">
                  {priceInfo.pe_ratio?.toFixed(2) || 'N/A'}
                </p>
              </div>
            </div>

            {/* Your Holdings */}
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Your Holdings</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Shares</p>
                  <p className="text-xl font-bold text-gray-900">{stock.shares}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Cost</p>
                  <p className="text-xl font-bold text-gray-900">${stock.purchase_price.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Cost</p>
                  <p className="text-xl font-bold text-gray-900">${stock.total_cost.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Market Value</p>
                  <p className="text-xl font-bold text-gray-900">
                    ${(stock.shares * priceInfo.current_price).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Period Selector */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Price History</h3>
                <div className="flex space-x-2">
                  {['1d', '5d', '1mo', '3mo', '6mo', '1y'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        period === p
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Simple Chart */}
              <div className="bg-gray-50 rounded-lg p-4 h-64 flex items-end space-x-1">
                {history.slice(-30).map((point, index) => {
                  const minPrice = Math.min(...history.map(h => h.low));
                  const maxPrice = Math.max(...history.map(h => h.high));
                  const height = ((point.close - minPrice) / (maxPrice - minPrice)) * 100;
                  const isPositive = point.close >= point.open;
                  
                  return (
                    <div
                      key={index}
                      className={`flex-1 rounded-t ${
                        isPositive ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{ height: `${height}%` }}
                      title={`${new Date(point.date).toLocaleDateString()}: $${point.close.toFixed(2)}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-600">
            Failed to load stock details
          </div>
        )}
      </div>
    </div>
  );
}