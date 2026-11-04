import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, Check, Pencil, Plus, Radar, Repeat, RotateCcw, Trash2, X } from 'lucide-react';
import { errorMessage, subscriptionsAPI, type Cycle, type DetectedCharge, type Subscription, type SubscriptionSummary } from '../../services/api';
import { CategoryTile, EmptyState, Money, PageHeader, Spinner } from '../ui';

const CYCLE_LABEL: Record<Cycle, string> = { weekly: '/wk', monthly: '/mo', yearly: '/yr' };

function daysUntil(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
  return Math.ceil((new Date(d.toDateString()).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
}

function renewalText(s: Subscription) {
  const n = daysUntil(s.next_date);
  if (n === null) return 'No renewal date';
  if (n <= 0) return 'Renews today';
  if (n === 1) return 'Renews tomorrow';
  return `Renews in ${n} days · ${new Date(s.next_date!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

type Draft = { id?: number; name: string; amount: string; cycle: Cycle; next_date: string };
const EMPTY: Draft = { name: '', amount: '', cycle: 'monthly', next_date: '' };

function SubForm({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = { name: d.name, amount: Number(d.amount), cycle: d.cycle, next_date: d.next_date || null };
      if (d.id) await subscriptionsAPI.update(d.id, payload);
      else await subscriptionsAPI.add(payload);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.form onSubmit={submit} onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-lift">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold text-ink">{d.id ? 'Edit subscription' : 'Add a subscription'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Name</span>
            <input className="input mt-1" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Netflix" required maxLength={120} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Amount</span>
              <input className="input mt-1" type="number" min="0" step="0.01" value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value })} required />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Billed</span>
              <select className="input mt-1" value={d.cycle} onChange={(e) => setD({ ...d, cycle: e.target.value as Cycle })}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Next renewal <span className="font-normal text-gray-400">(optional)</span></span>
            <input className="input mt-1" type="date" value={d.next_date} onChange={(e) => setD({ ...d, next_date: e.target.value })} />
          </label>
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{d.id ? 'Save changes' : 'Add subscription'}</button>
        </div>
      </motion.form>
    </div>
  );
}

export default function SubscriptionsPage() {
  const [data, setData] = useState<SubscriptionSummary | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setData((await subscriptionsAPI.list()).data);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  useEffect(() => {
    // Async fetch on open; state is set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const act = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
      await load();
      window.dispatchEvent(new Event('zenty:data-changed'));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const confirmDetected = (d: DetectedCharge) =>
    act(() => subscriptionsAPI.add({ name: d.name, amount: d.amount, cycle: 'monthly', next_date: d.next_date, category: d.category, merchant_key: d.merchant_key, source: 'detected' }));

  if (!data) return <Spinner />;
  const active = data.items.filter((s) => s.status === 'active');
  const cancelled = data.items.filter((s) => s.status === 'cancelled');
  const savedByCancelling = cancelled.reduce((sum, s) => sum + s.monthly_cost, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Subscriptions" subtitle="Everything that renews, in one place."
        actions={<button onClick={() => setEditing(EMPTY)} className="btn-primary"><Plus className="h-4 w-4" /> Add subscription</button>} />

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* Totals */}
      <section className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-lilac-500/25 blur-3xl" />
        <div className="relative grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-sm text-white/60">Per month</p>
            <p className="mt-1 font-display text-4xl font-semibold"><Money value={data.totals.monthly} /></p>
          </div>
          <div>
            <p className="text-sm text-white/60">Per year</p>
            <p className="mt-1 font-display text-4xl font-semibold text-saffron-300"><Money value={data.totals.yearly} cents={false} /></p>
          </div>
          <div>
            <p className="text-sm text-white/60">Active</p>
            <p className="mt-1 font-display text-4xl font-semibold">{data.totals.active}</p>
            {savedByCancelling > 0 && <p className="mt-1 text-sm text-matcha-300">Saving <Money value={savedByCancelling} />/mo from cancelled ones</p>}
          </div>
        </div>
      </section>

      {/* Detected */}
      <AnimatePresence>
        {data.suggestions.length > 0 && (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-3xl border border-lilac-200 bg-lilac-50 p-6">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><Radar className="h-5 w-5 text-lilac-600" /> Zenty found {data.suggestions.length} possible subscription{data.suggestions.length === 1 ? '' : 's'}</h2>
            <p className="mt-1 text-sm text-gray-600">These charges repeat every month. Track the real ones; dismiss anything that isn't a subscription.</p>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {data.suggestions.map((d) => (
                <li key={d.merchant_key} className="flex items-center gap-3 rounded-2xl border border-white bg-white/80 p-3">
                  <CategoryTile name={d.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{d.name}</p>
                    <p className="text-xs text-gray-500"><Money value={d.amount} />/mo · {d.category}</p>
                  </div>
                  <button onClick={() => confirmDetected(d)} className="btn-primary !px-3 !py-1.5 !text-xs"><Check className="h-3.5 w-3.5" /> Track</button>
                  <button onClick={() => act(() => subscriptionsAPI.ignore(d.merchant_key, d.name))} className="btn-ghost !px-3 !py-1.5 !text-xs">Not one</button>
                </li>
              ))}
            </ul>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Upcoming */}
      {data.upcoming.length > 0 && (
        <section className="card p-6">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><BellRing className="h-4 w-4 text-saffron-500" /> Renewing in the next 2 weeks</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {data.upcoming.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-2 rounded-2xl border border-saffron-200 bg-saffron-50 px-3 py-2 text-sm">
                <span className="font-medium text-ink">{s.name}</span>
                <Money value={s.amount} className="text-gray-600" />
                <span className="text-xs text-saffron-700">{renewalText(s).replace(/ · .*/, '')}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Active list */}
      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-6 py-4 font-semibold text-ink">Active</h2>
        {active.length === 0 ? (
          <EmptyState icon={Repeat} title="Nothing tracked yet" text="Track a detected charge above or add one yourself."
            action={<button onClick={() => setEditing(EMPTY)} className="btn-primary"><Plus className="h-4 w-4" /> Add subscription</button>} />
        ) : (
          <ul className="divide-y divide-line">
            {active.map((s) => (
              <li key={s.id} className="group flex flex-wrap items-center gap-4 px-6 py-4">
                <CategoryTile name={s.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{s.name}</p>
                  <p className="text-xs text-gray-500">{renewalText(s)}{s.source === 'detected' ? ' · found by Zenty' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-ink"><Money value={s.amount} />{CYCLE_LABEL[s.cycle]}</p>
                  {s.cycle !== 'monthly' && <p className="text-xs text-gray-500">≈ <Money value={s.monthly_cost} />/mo</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing({ id: s.id, name: s.name, amount: String(s.amount), cycle: s.cycle, next_date: s.next_date ? s.next_date.slice(0, 10) : '' })}
                    aria-label={`Edit ${s.name}`} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-ink"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => act(() => subscriptionsAPI.update(s.id, { status: 'cancelled' }))}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Mark cancelled</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cancelled.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-6 py-4 font-semibold text-ink">Cancelled</h2>
          <ul className="divide-y divide-line">
            {cancelled.map((s) => (
              <li key={s.id} className="flex items-center gap-4 px-6 py-3.5 text-gray-500">
                <CategoryTile name={s.name} size="sm" />
                <p className="flex-1 truncate line-through">{s.name}</p>
                <Money value={s.amount} className="text-sm" />
                <button onClick={() => act(() => subscriptionsAPI.update(s.id, { status: 'active' }))} aria-label={`Reactivate ${s.name}`}
                  className="rounded-lg p-2 hover:bg-gray-100 hover:text-ink" title="Reactivate"><RotateCcw className="h-4 w-4" /></button>
                <button onClick={() => window.confirm(`Remove ${s.name} from Zenty?`) && act(() => subscriptionsAPI.remove(s.id))} aria-label={`Remove ${s.name}`}
                  className="rounded-lg p-2 hover:bg-red-50 hover:text-red-600" title="Remove"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-gray-400">Marking a subscription cancelled here only updates Zenty. To stop being charged, cancel with the company too.</p>

      {editing && <SubForm draft={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); window.dispatchEvent(new Event('zenty:data-changed')); }} />}
    </div>
  );
}
