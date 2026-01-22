// frontend/src/components/Transactions/TransactionsList.tsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Plus, Filter, RefreshCw } from 'lucide-react';
import { transactionAPI, Transaction } from '../../services/api';
import AddTransactionModal from './AddTransactionModal';

export default function TransactionsList() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      console.log('Loading transactions...');
      const response = await transactionAPI.getAll();
      console.log('Loaded transactions:', response.data);
      setTransactions(response.data.transactions);
    } catch (error: any) {
      console.error('Failed to load transactions:', error);
      console.error('Error details:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this transaction?')) return;
    
    try {
      console.log('Deleting transaction:', id);
      await transactionAPI.delete(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      console.log('Transaction deleted successfully');
    } catch (error: any) {
      console.error('Failed to delete:', error);
      alert(`Failed to delete transaction: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleAddTransaction = async (transaction: Transaction) => {
    console.log('handleAddTransaction called with:', transaction);
    
    try {
      const response = await transactionAPI.create(transaction);
      console.log('Transaction created response:', response.data);
      
      // Reload transactions to ensure we have the latest data
      await loadTransactions();
      
      // Close modal
      setShowModal(false);
      
      console.log('Transaction added successfully!');
      
    } catch (error: any) {
      console.error('Failed to add transaction:', error);
      console.error('Error response:', error.response?.data);
      
      // Re-throw the error so the modal can display it
      throw error;
    }
  };

  const filteredTransactions = transactions.filter(t => 
    filter === 'all' || t.type === filter
  );

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      groceries: 'bg-green-100 text-green-800',
      food: 'bg-orange-100 text-orange-800',
      transport: 'bg-blue-100 text-blue-800',
      entertainment: 'bg-purple-100 text-purple-800',
      utilities: 'bg-gray-100 text-gray-800',
      income: 'bg-emerald-100 text-emerald-800',
      rent: 'bg-red-100 text-red-800',
      healthcare: 'bg-pink-100 text-pink-800',
      shopping: 'bg-indigo-100 text-indigo-800',
      education: 'bg-yellow-100 text-yellow-800',
      other: 'bg-slate-100 text-slate-800',
    };
    return colors[category.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="mt-2 text-gray-600">
            Manage your income and expenses ({transactions.length} total)
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex space-x-2">
        {['all', 'income', 'expense'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-2 rounded-lg capitalize transition-colors ${
              filter === f
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f} {filter === f && `(${filteredTransactions.length})`}
          </button>
        ))}
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No transactions found</p>
            <p className="text-gray-400 text-sm mt-2">
              {filter !== 'all' 
                ? `No ${filter} transactions to display`
                : 'Click "Add Transaction" to get started'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTransactions.map((transaction, index) => (
              <motion.div
                key={transaction.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(transaction.category)}`}>
                        {transaction.category}
                      </span>
                      <span className="text-sm text-gray-600">
                        {transaction.date 
                          ? new Date(transaction.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                          : 'No date'
                        }
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        transaction.type === 'income' 
                          ? 'bg-green-50 text-green-700' 
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {transaction.type}
                      </span>
                    </div>
                    {transaction.description && (
                      <p className="mt-2 text-sm text-gray-700">{transaction.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`text-lg font-semibold ${
                      transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
                    </span>
                    <button
                      onClick={() => handleDelete(transaction.id!)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {showModal && (
        <AddTransactionModal
          onClose={() => setShowModal(false)}
          onSubmit={handleAddTransaction}
        />
      )}
    </div>
  );
}