import { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Receipt, Search, Trash2 } from 'lucide-react';
import AddTransactionModal from './AddTransactionModal';
import { errorMessage, transactionAPI, type Transaction } from '../../services/api';
import { CategoryTile, EmptyState, Money, PageHeader, Spinner, relativeDay } from '../ui';

type Filter = 'all' | 'expense' | 'income';

export default function TransactionList() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const r = await transactionAPI.getAll();
      setItems(r.data.transactions);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    window.addEventListener('zenty:data-changed', load);
    return () => window.removeEventListener('zenty:data-changed', load);
  }, []);

  const add = async (t: Transaction) => {
    await transactionAPI.create(t);
    setShowAdd(false);
    await load();
  };

  const remove = async (t: Transaction) => {
    if (!t.id || !window.confirm(`Delete "${t.description || t.category}"?`)) return;
    try {
      await transactionAPI.delete(t.id);
      setItems((xs) => xs.filter((x) => x.id !== t.id));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const categories = useMemo(() => [...new Set(items.map((t) => t.category))].sort(), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((t) =>
      (filter === 'all' || t.type === filter) &&
      (!category || t.category === category) &&
      (!q || `${t.description} ${t.category}`.toLowerCase().includes(q)));
  }, [items, query, filter, category]);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const key = t.date ? relativeDay(t.date) : 'Undated';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()];
  }, [filtered]);

  const totals = useMemo(() => ({
    in: filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    out: filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  }), [filtered]);

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle="Everything coming in and going out."
        actions={<button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="h-4 w-4" /> Add transaction</button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Money in</p>
          <p className="mt-2 font-display text-2xl font-semibold text-primary-700"><Money value={totals.in} /></p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Money out</p>
          <p className="mt-2 font-display text-2xl font-semibold text-ink"><Money value={totals.out} /></p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Net</p>
          <p className={`mt-2 font-display text-2xl font-semibold ${totals.in - totals.out >= 0 ? 'text-primary-700' : 'text-red-600'}`}>
            <Money value={totals.in - totals.out} sign />
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <label className="relative min-w-[200px] flex-1">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search transactions" className="input pl-10" />
          </label>
          <div className="flex rounded-xl bg-gray-100 p-1 text-sm font-medium" role="tablist">
            {(['all', 'expense', 'income'] as Filter[]).map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 capitalize transition ${filter === f ? 'bg-white text-ink shadow-card' : 'text-gray-500 hover:text-ink'}`}>
                {f === 'all' ? 'All' : f === 'expense' ? 'Spending' : 'Income'}
              </button>
            ))}
          </div>
          {categories.length > 1 && (
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input w-auto" aria-label="Filter by category">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
        </div>

        {error && <p className="m-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Receipt} title={items.length ? 'No matches' : 'No transactions yet'}
            text={items.length ? 'Try a different search or filter.' : 'Add one here, use quick add at the top, or link your bank.'}
            action={!items.length && <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="h-4 w-4" /> Add transaction</button>} />
        ) : (
          <div>
            {groups.map(([day, txns]) => (
              <div key={day}>
                <div className="flex items-center justify-between bg-gray-50 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <span>{day}</span>
                  <Money value={txns.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)} sign className="normal-case tracking-normal" />
                </div>
                <ul className="divide-y divide-line">
                  {txns.map((t) => (
                    <li key={t.id} className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-gray-50/70">
                      <CategoryTile name={t.category} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">{t.description || t.category}</p>
                        <p className="flex items-center gap-1.5 text-xs text-gray-500">
                          {t.category}
                          {t.source === 'bank' && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5"><Building2 className="h-3 w-3" /> Bank</span>}
                        </p>
                      </div>
                      <Money value={t.type === 'income' ? t.amount : -t.amount} sign
                        className={`font-semibold ${t.type === 'income' ? 'text-primary-700' : 'text-ink'}`} />
                      <button onClick={() => remove(t)} aria-label="Delete transaction"
                        className="rounded-lg p-2 text-gray-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddTransactionModal onClose={() => setShowAdd(false)} onSubmit={add} />}
    </div>
  );
}
