// frontend/src/components/Analytics/AnalyticsPage.tsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, AlertCircle, DollarSign } from 'lucide-react';
import { predictionAPI, adviceAPI } from '../../services/api';

export default function AnalyticsPage() {
  const [predictions, setPredictions] = useState<any>(null);
  const [advice, setAdvice] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [predRes, adviceRes] = await Promise.all([
        predictionAPI.predictNextMonth(),
        adviceAPI.getAdvice()
      ]);

      setPredictions(predRes.data.predictions);
      setAdvice(adviceRes.data.advice);
    } catch (error) {
      console.error('Failed to load analytics:', error);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics & Insights</h1>
        <p className="mt-2 text-gray-600">AI-powered predictions and recommendations</p>
      </div>

      {/* AI Advice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl p-6 border border-primary-100"
      >
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <AlertCircle className="h-6 w-6 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              💡 Personalized Financial Advice
            </h3>
            <div className="text-gray-700 whitespace-pre-line">
              {advice || 'Add more transactions to get personalized advice!'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Predictions */}
      {predictions && Object.keys(predictions).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-primary-600" />
            Next Month Predictions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(predictions).map(([category, data]: [string, any]) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 capitalize">
                    {category}
                  </span>
                  <DollarSign className="h-4 w-4 text-gray-400" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  ${data.total?.toFixed(2) || '0.00'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Avg: ${data.daily_avg?.toFixed(2) || '0.00'}/day
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {(!predictions || Object.keys(predictions).length === 0) && (
        <div className="bg-white rounded-xl shadow-sm p-12 border border-gray-100 text-center">
          <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Not Enough Data
          </h3>
          <p className="text-gray-600">
            Add at least 30 transactions to see AI-powered predictions
          </p>
        </div>
      )}
    </div>
  );
}