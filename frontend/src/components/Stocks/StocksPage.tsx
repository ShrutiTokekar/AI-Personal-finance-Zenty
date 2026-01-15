// frontend/src/components/Stocks/StocksPage.tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Plus, Trash2, DollarSign, Calendar, RefreshCw } from 'lucide-react';
import { stocksAPI, Stock } from '../../services/api';
import AddStockModal from './AddStockModal';

interface StockWithPrice extends Stock {
  current_price?: number;
  price_change?: number;
  price_change_percent?: number;
  market_value?: number;
  total_gain_loss?: number;
  gain_loss_percent?: number;
}

export default function StocksPage() {
  const [stocks, setStocks] = useState<StockWithPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStocks();
  }, []);

  const loadStocks = async () => {
    try {
      setLoading(true);
      // The backend now automatically fetches real prices
      const response = await stocksAPI.getAll();
      setStocks(response.data.stocks);
    } catch (error) {
      console.error('Failed to load stocks:', error);
      setStocks([]);
    } finally {
      setLoading(false);
    }
  };


  const fetchStockPrices = async (stocksData: Stock[]) => {
    try {
      // Get unique symbols
      const symbols = [...new Set(stocksData.map(s => s.symbol))];
      
      // Fetch prices from Alpha Vantage or a free API
      // For demo purposes, we'll simulate prices
      const stocksWithPrices = stocksData.map(stock => {
        // Simulate price (in production, fetch from real API)
        const priceChange = (Math.random() - 0.5) * 20; // -10 to +10
        const current_price = stock.purchase_price + priceChange;
        const market_value = current_price * stock.shares;
        const total_gain_loss = market_value - stock.total_cost;
        const gain_loss_percent = (total_gain_loss / stock.total_cost) * 100;
        
        return {
          ...stock,
          current_price,
          price_change: priceChange,
          price_change_percent: (priceChange / stock.purchase_price) * 100,
          market_value,
          total_gain_loss,
          gain_loss_percent,
        };
      });

      setStocks(stocksWithPrices);
    } catch (error) {
      console.error('Failed to fetch prices:', error);
      setStocks(stocksData);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStocks();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this stock holding?')) return;
    
    try {
      await stocksAPI.delete(id);
      setStocks(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to delete stock:', error);
    }
  };

  // Calculate portfolio totals
  const totalInvested = stocks.reduce((sum, s) => sum + s.total_cost, 0);
  const totalMarketValue = stocks.reduce((sum, s) => sum + (s.market_value || s.total_cost), 0);
  const totalGainLoss = totalMarketValue - totalInvested;
  const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stock Portfolio</h1>
          <p className="mt-2 text-gray-600">Track your investments and performance</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Add Stock</span>
          </button>
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Invested</h3>
            <DollarSign className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${totalInvested.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Market Value</h3>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${totalMarketValue.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Gain/Loss</h3>
            {totalGainLoss >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
          </div>
          <p className={`text-2xl font-bold ${totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalGainLoss >= 0 ? '+' : ''}${totalGainLoss.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Return</h3>
            <TrendingUp className={`h-5 w-5 ${totalGainLossPercent >= 0 ? 'text-green-500' : 'text-red-500'}`} />
          </div>
          <p className={`text-2xl font-bold ${totalGainLossPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalGainLossPercent >= 0 ? '+' : ''}{totalGainLossPercent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Holdings List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : stocks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Stock Holdings Yet</h3>
          <p className="text-gray-600 mb-4">Start building your investment portfolio!</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Add Your First Stock</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Symbol
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Shares
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Purchase Price
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Current Price
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Total Cost
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Market Value
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Gain/Loss
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <AnimatePresence>
                  {stocks.map((stock, index) => (
                    <motion.tr
                      key={stock.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-bold text-gray-900">{stock.symbol}</div>
                          {stock.name && (
                            <div className="text-sm text-gray-500">{stock.name}</div>
                          )}
                          <div className="text-xs text-gray-400 flex items-center mt-1">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(stock.purchase_date).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        {stock.shares}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-700">
                        ${stock.purchase_price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {stock.current_price ? (
                          <div>
                            <div className="font-semibold text-gray-900">
                              ${stock.current_price.toFixed(2)}
                            </div>
                            {stock.price_change !== undefined && (
                              <div className={`text-xs flex items-center justify-end ${
                                stock.price_change >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {stock.price_change >= 0 ? (
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                ) : (
                                  <TrendingDown className="h-3 w-3 mr-1" />
                                )}
                                {stock.price_change >= 0 ? '+' : ''}
                                {stock.price_change_percent?.toFixed(2)}%
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        ${stock.total_cost.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {stock.market_value ? (
                          <span className="font-semibold text-gray-900">
                            ${stock.market_value.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {stock.total_gain_loss !== undefined ? (
                          <div>
                            <div className={`font-bold ${
                              stock.total_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {stock.total_gain_loss >= 0 ? '+' : ''}
                              ${Math.abs(stock.total_gain_loss).toFixed(2)}
                            </div>
                            <div className={`text-xs ${
                              stock.total_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              ({stock.gain_loss_percent && stock.gain_loss_percent >= 0 ? '+' : ''}
                              {stock.gain_loss_percent?.toFixed(2)}%)
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleDelete(stock.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete stock"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Stock prices are simulated for demo purposes. In production, 
          integrate with a real-time stock API like Alpha Vantage, Yahoo Finance, or IEX Cloud 
          for accurate pricing data.
        </p>
      </div>

      {/* Add Stock Modal */}
      {showAddModal && (
        <AddStockModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadStocks();
          }}
        />
      )}
    </div>
  );
}