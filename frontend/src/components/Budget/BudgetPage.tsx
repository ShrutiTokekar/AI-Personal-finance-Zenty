import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import CreateBudgetModal from './CreateBudgetModal';
import EditBudgetModal from './EditBudgetModal';
import { budgetAPI, errorMessage, type Budget, type BudgetSummary } from '../../services/api';
import { CategoryTile, EmptyState, Money, PageHeader, Progress, Spinner } from '../ui';

export default function BudgetPage() {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const r = await budgetAPI.getSummary();
      setSummary(r.data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (b: Budget) => {
    if (!window.confirm(`Delete the ${b.category} budget?`)) return;
    try {
      await budgetAPI.delete(b.id);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;
  const monthPct = (now.getDate() / daysInMonth) * 100;
  const budgets = summary?.budgets || [];
  const over = budgets.filter((b) => b.remaining < 0).length;

  return (
    <div>
      <PageHeader
        title="Budgets"
        subtitle={`${now.toLocaleDateString(undefined, { month: 'long' })} · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
        actions={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="h-4 w-4" /> New budget</button>}
      />

      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <Spinner />
      ) : budgets.length === 0 ? (
        <div className="card">
          <EmptyState icon={Wallet} title="No budgets yet"
            text="Pick a category you spend on often, like groceries or dining, and set a monthly limit. Zenty tracks it automatically."
            action={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="h-4 w-4" /> Create your first budget</button>} />
        </div>
      ) : (
        <>
          {/* Overview */}
          <section className="relative mb-6 overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-8">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary-500/25 blur-3xl" />
            <div className="relative grid gap-6 sm:grid-cols-3">
              <div>
                <p className="text-sm text-white/60">Spent this month</p>
                <p className="mt-1 font-display text-4xl font-semibold"><Money value={summary!.total_spent} cents={false} /></p>
                <p className="mt-1 text-sm text-white/50">of <Money value={summary!.total_budget} cents={false} /> budgeted</p>
              </div>
              <div>
                <p className="text-sm text-white/60">Left to spend</p>
                <p className={`mt-1 font-display text-4xl font-semibold ${summary!.total_remaining < 0 ? 'text-red-300' : 'text-matcha-300'}`}>
                  <Money value={summary!.total_remaining} cents={false} />
                </p>
                <p className="mt-1 text-sm text-white/50">
                  ≈ <Money value={Math.max(0, summary!.total_remaining) / daysLeft} cents={false} /> per day
                </p>
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                {over > 0 ? (
                  <span className="inline-flex items-center gap-2 rounded-2xl bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-200">
                    <AlertTriangle className="h-4 w-4" /> {over} over budget
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-2xl bg-matcha-300/15 px-4 py-2 text-sm font-semibold text-matcha-300">
                    <CheckCircle2 className="h-4 w-4" /> All on track
                  </span>
                )}
              </div>
            </div>
            <div className="relative mt-6">
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-matcha-300 to-primary-300 transition-all"
                  style={{ width: `${Math.min(100, summary!.total_budget ? (summary!.total_spent / summary!.total_budget) * 100 : 0)}%` }} />
              </div>
              <div className="relative mt-1 h-3">
                <span className="absolute -translate-x-1/2 text-[11px] text-white/50" style={{ left: `${monthPct}%` }}>▲ today</span>
              </div>
            </div>
          </section>

          {/* Budget cards */}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {budgets.map((b) => {
              const pct = b.monthly_limit ? (b.current_spent / b.monthly_limit) * 100 : 0;
              const pace = pct - monthPct; // positive = spending faster than the month is passing
              return (
                <div key={b.id} className="card group p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CategoryTile name={b.category} />
                      <div>
                        <h3 className="font-semibold text-ink">{b.category}</h3>
                        <p className="text-xs text-gray-500">
                          {pct > 100 ? 'Over budget' : pace > 10 ? 'Spending fast' : 'On track'}
                        </p>
                      </div>
                    </div>
                    <div className="flex opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                      <button onClick={() => setEditing(b)} aria-label={`Edit ${b.category} budget`} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-ink"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(b)} aria-label={`Delete ${b.category} budget`} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="mt-5 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-semibold text-ink"><Money value={b.current_spent} cents={false} /></span>
                    <span className="text-sm text-gray-500">of <Money value={b.monthly_limit} cents={false} /></span>
                  </div>
                  <div className="relative mt-3">
                    <Progress value={b.current_spent} max={b.monthly_limit} />
                    <span className="absolute -top-1 h-4 w-0.5 rounded bg-ink/30" style={{ left: `${monthPct}%` }} title="Where you'd be if spending evenly" />
                  </div>
                  <p className={`mt-3 text-sm ${b.remaining < 0 ? 'font-medium text-red-600' : 'text-gray-600'}`}>
                    {b.remaining < 0
                      ? <>Over by <Money value={-b.remaining} cents={false} /></>
                      : <><Money value={b.remaining} cents={false} className="font-medium text-ink" /> left · <Money value={b.remaining / daysLeft} cents={false} />/day</>}
                  </p>
                </div>
              );
            })}
            <button onClick={() => setShowCreate(true)}
              className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line text-gray-500 transition hover:border-primary-300 hover:bg-white hover:text-primary-700">
              <Plus className="h-6 w-6" /> <span className="font-medium">Add a budget</span>
            </button>
          </div>
          <p className="mt-4 text-xs text-gray-400">The small line on each bar marks where you'd be if you spent evenly through the month.</p>
        </>
      )}

      {showCreate && <CreateBudgetModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); load(); }} />}
      {editing && <EditBudgetModal budget={editing} onClose={() => setEditing(null)} onSuccess={() => { setEditing(null); load(); }} />}
    </div>
  );
}
