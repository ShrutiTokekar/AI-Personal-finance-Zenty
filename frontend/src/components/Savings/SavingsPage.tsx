import { useEffect, useState } from 'react';
import { CalendarClock, PiggyBank, Plus, Trash2, Trophy } from 'lucide-react';
import CreateGoalModal from './CreateGoalModal';
import ContributeModal from './ContributeModal';
import { errorMessage, savingsAPI, type SavingsGoal } from '../../services/api';
import { EmptyState, Money, PageHeader, Spinner } from '../ui';

function GoalRing({ pct, done }: { pct: number; done: boolean }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct)) / 100;
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#ece5d3" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={done ? '#93c234' : '#6c914c'} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-sm font-bold text-ink">
        {done ? <Trophy className="h-6 w-6 text-matcha-600" /> : `${Math.round(pct)}%`}
      </span>
    </div>
  );
}

function monthsUntil(deadline: string) {
  const d = new Date(deadline);
  const now = new Date();
  return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
}

export default function SavingsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [contributing, setContributing] = useState<SavingsGoal | null>(null);
  const [error, setError] = useState('');

  const load = async (includeDone = showDone) => {
    try {
      const r = await savingsAPI.getGoals(includeDone);
      setGoals(r.data.goals);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(showDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDone]);

  const remove = async (g: SavingsGoal) => {
    if (!window.confirm(`Delete the goal "${g.name}"?`)) return;
    try {
      await savingsAPI.deleteGoal(g.id);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const saved = goals.reduce((s, g) => s + g.current_amount, 0);
  const target = goals.reduce((s, g) => s + g.target_amount, 0);

  return (
    <div>
      <PageHeader
        title="Goals"
        subtitle="Save on purpose, one goal at a time."
        actions={
          <>
            <label className="btn-ghost cursor-pointer">
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-primary-600" />
              Show completed
            </label>
            <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="h-4 w-4" /> New goal</button>
          </>
        }
      />

      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <Spinner />
      ) : goals.length === 0 ? (
        <div className="card">
          <EmptyState icon={PiggyBank} title="No goals yet"
            text="An emergency fund, a trip, a new laptop. Give your savings a purpose and watch it grow."
            action={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="h-4 w-4" /> Create a goal</button>} />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="card p-5">
              <p className="text-sm text-gray-500">Saved so far</p>
              <p className="mt-2 font-display text-2xl font-semibold text-ink"><Money value={saved} cents={false} /></p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-gray-500">Total target</p>
              <p className="mt-2 font-display text-2xl font-semibold text-ink"><Money value={target} cents={false} /></p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-gray-500">Overall progress</p>
              <p className="mt-2 font-display text-2xl font-semibold text-primary-700">{target ? Math.round((saved / target) * 100) : 0}%</p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((g) => {
              const months = g.deadline ? monthsUntil(g.deadline) : null;
              const perMonth = months && months > 0 && g.remaining > 0 ? g.remaining / months : null;
              return (
                <div key={g.id} className="card group flex flex-col p-6">
                  <div className="flex items-start gap-4">
                    <GoalRing pct={g.progress} done={g.completed} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-semibold text-ink">{g.name}</h3>
                      {g.description && <p className="line-clamp-2 text-sm text-gray-500">{g.description}</p>}
                      <p className="mt-2 text-sm text-gray-600">
                        <Money value={g.current_amount} cents={false} className="font-semibold text-ink" /> of <Money value={g.target_amount} cents={false} />
                      </p>
                    </div>
                    <button onClick={() => remove(g)} aria-label={`Delete ${g.name}`}
                      className="rounded-lg p-2 text-gray-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {g.deadline && (
                    <p className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600">
                      <CalendarClock className="h-4 w-4 text-gray-400" />
                      {g.completed ? 'Completed' : months !== null && months <= 0 ? 'Deadline reached' : (
                        <>By {new Date(g.deadline).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                          {perMonth && <> · save <Money value={perMonth} cents={false} className="font-semibold text-ink" />/mo</>}</>
                      )}
                    </p>
                  )}
                  {!g.completed && (
                    <button onClick={() => setContributing(g)} className="btn-ghost mt-5 w-full">
                      <Plus className="h-4 w-4" /> Add money
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {showCreate && <CreateGoalModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); load(); }} />}
      {contributing && <ContributeModal goal={contributing} onClose={() => setContributing(null)} onSuccess={() => { setContributing(null); load(); }} />}
    </div>
  );
}
