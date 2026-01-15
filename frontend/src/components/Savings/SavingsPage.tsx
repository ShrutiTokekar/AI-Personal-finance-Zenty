// frontend/src/components/Savings/SavingsPage.tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Plus, TrendingUp, Calendar, Trash2, DollarSign } from 'lucide-react';
import { savingsAPI, SavingsGoal } from '../../services/api';
import CreateGoalModal from './CreateGoalModal';
import ContributeModal from './ContributeModal';

export default function SavingsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      setLoading(true);
      const response = await savingsAPI.getGoals(false);
      setGoals(response.data.goals);
    } catch (error) {
      console.error('Failed to load goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this savings goal?')) return;
    
    try {
      await savingsAPI.deleteGoal(id);
      setGoals(prev => prev.filter(g => g.id !== id));
    } catch (error) {
      console.error('Failed to delete goal:', error);
    }
  };

  const handleContribute = (goal: SavingsGoal) => {
    setSelectedGoal(goal);
    setShowContributeModal(true);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-blue-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const totalSaved = goals.reduce((sum, goal) => sum + goal.current_amount, 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.target_amount, 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Savings Goals</h1>
          <p className="mt-2 text-gray-600">Track your progress toward financial goals</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>New Goal</span>
        </button>
      </div>

      {/* Overall Progress */}
      <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl p-6 border border-primary-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Total Progress</h3>
            <p className="text-sm text-gray-600">Across all goals</p>
          </div>
          <Target className="h-8 w-8 text-primary-600" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Saved: ${totalSaved.toFixed(2)}</span>
            <span className="text-gray-600">Target: ${totalTarget.toFixed(2)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(overallProgress, 100)}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="bg-primary-600 h-3 rounded-full"
            />
          </div>
          <p className="text-right text-sm font-semibold text-primary-600">
            {overallProgress.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Goals List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Savings Goals Yet</h3>
          <p className="text-gray-600 mb-4">Start saving for something you care about!</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Create Your First Goal</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence>
            {goals.map((goal, index) => (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-white rounded-xl shadow-sm border p-6 ${
                  goal.completed ? 'border-green-300' : 'border-gray-100'
                }`}
              >
                {/* Goal Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                      {goal.name}
                      {goal.completed && (
                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          ✓ Completed
                        </span>
                      )}
                    </h3>
                    {goal.deadline && (
                      <p className="text-sm text-gray-500 flex items-center mt-1">
                        <Calendar className="h-4 w-4 mr-1" />
                        Due: {new Date(goal.deadline).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>

                {/* Progress */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-gray-700">
                      ${goal.current_amount.toFixed(2)}
                    </span>
                    <span className="text-gray-500">
                      ${goal.target_amount.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(goal.progress, 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className={`h-3 rounded-full ${getProgressColor(goal.progress)}`}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">
                      {goal.progress.toFixed(1)}% Complete
                    </span>
                    <span className="text-sm text-gray-500">
                      ${goal.remaining.toFixed(2)} remaining
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {!goal.completed && (
                  <button
                    onClick={() => handleContribute(goal)}
                    className="w-full mt-4 flex items-center justify-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <DollarSign className="h-5 w-5" />
                    <span>Add Money</span>
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateGoalModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadGoals();
          }}
        />
      )}

      {showContributeModal && selectedGoal && (
        <ContributeModal
          goal={selectedGoal}
          onClose={() => {
            setShowContributeModal(false);
            setSelectedGoal(null);
          }}
          onSuccess={() => {
            setShowContributeModal(false);
            setSelectedGoal(null);
            loadGoals();
          }}
        />
      )}
    </div>
  );
}