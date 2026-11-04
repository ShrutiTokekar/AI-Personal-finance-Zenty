import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, Leaf, Lightbulb, Receipt, TrendingUp } from 'lucide-react';
import { adviceAPI, anomaliesAPI, overviewAPI, predictionAPI, type Overview, type Transaction } from '../../services/api';
import SpendingCalendar from '../SpendingCalendar';
import { Card, CategoryTile, EmptyState, Money, PageHeader, Spinner, relativeDay } from '../ui';

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [predictions, setPredictions] = useState<Record<string, number>>({});
  const [advice, setAdvice] = useState('');
  const [unusual, setUnusual] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [o, p, a, u] = await Promise.all([overviewAPI.get(), predictionAPI.predictNextMonth(), adviceAPI.getAdvice(), anomaliesAPI.get()]);
        setOverview(o.data);
        setPredictions(p.data.predictions || {});
        setAdvice(a.data.advice);
        setUnusual(u.data.anomalies);
      } finally {
        setLoading(false);
      }
    };
    load();
    window.addEventListener('zenty:data-changed', load);
    return () => window.removeEventListener('zenty:data-changed', load);
  }, []);

  if (loading || !overview) return <Spinner />;

  const now = new Date();
  const monthName = now.toLocaleDateString(undefined, { month: 'long' });
  const daily = overview.daily.filter((d) => !d.future);
  const spendDays = daily.filter((d) => d.amount > 0);
  const total = daily.reduce((s, d) => s + d.amount, 0);
  const avg = daily.length ? total / daily.length : 0;
  const heaviest = spendDays.reduce<{ day: number; amount: number } | null>((m, d) => (!m || d.amount > m.amount ? d : m), null);
  const noSpend = daily.length - spendDays.length;
  const byWeekday = Array.from({ length: 7 }, () => 0);
  daily.forEach((d) => { byWeekday[new Date(now.getFullYear(), now.getMonth(), d.day).getDay()] += d.amount; });
  const topWeekday = byWeekday.indexOf(Math.max(...byWeekday));
  const preds = Object.entries(predictions).sort((a, b) => b[1] - a[1]);
  const predTotal = preds.reduce((s, [, v]) => s + v, 0);
  const predMax = preds[0]?.[1] || 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Insights" subtitle="Patterns, predictions and tips from your own spending." />

      {/* Advice + Zen breakdown */}
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="flex gap-4 rounded-3xl border border-lilac-200 bg-lilac-50 p-6 lg:col-span-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lilac-500 text-white"><Lightbulb className="h-5 w-5" /></span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lilac-600">This month's advice</p>
            <p className="mt-2 leading-relaxed text-ink">{advice || 'Add a few transactions and Zenty will start spotting patterns for you.'}</p>
          </div>
        </section>
        <Card title={`Zen Score · ${overview.zen.score}`} icon={Leaf} className="lg:col-span-2">
          <ul className="space-y-3">
            {overview.zen.factors.map((f) => (
              <li key={f.key}>
                <div className="flex justify-between text-sm"><span className="text-gray-600">{f.label}</span><span className="num font-semibold text-ink">{f.points}/{f.max}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-saffron-400 to-primary-500" style={{ width: `${(f.points / f.max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Spending calendar */}
      <Card title={`${monthName} spending calendar`} icon={CalendarDays}>
        <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
          <SpendingCalendar days={overview.daily} detailed />
          <dl className="grid grid-cols-2 gap-4 self-start lg:grid-cols-1">
            <div className="rounded-2xl bg-gray-50 p-4">
              <dt className="text-xs font-medium text-gray-500">Spent so far</dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-ink"><Money value={total} cents={false} /></dd>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4">
              <dt className="text-xs font-medium text-gray-500">Daily average</dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-ink"><Money value={avg} cents={false} /></dd>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4">
              <dt className="text-xs font-medium text-gray-500">Heaviest day</dt>
              <dd className="mt-1 font-semibold text-ink">
                {heaviest ? <>{now.toLocaleDateString(undefined, { month: 'short' })} {heaviest.day} · <Money value={heaviest.amount} cents={false} /></> : '—'}
              </dd>
            </div>
            <div className="rounded-2xl bg-primary-50 p-4">
              <dt className="text-xs font-medium text-primary-700">No-spend days</dt>
              <dd className="mt-1 font-semibold text-primary-800">{noSpend} so far{total > 0 && ` · busiest on ${['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][topWeekday]}`}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Next month */}
        <Card title="Next month, predicted" icon={TrendingUp} action={predTotal > 0 ? <span className="text-sm text-gray-500">≈ <Money value={predTotal} cents={false} /></span> : undefined}>
          {preds.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Not enough history yet" text="Predictions appear after one full month of expenses." />
          ) : (
            <ul className="space-y-3.5">
              {preds.slice(0, 7).map(([cat, v]) => (
                <li key={cat}>
                  <div className="flex justify-between text-sm"><span className="font-medium text-ink">{cat}</span><Money value={v} cents={false} className="text-gray-600" /></div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-lilac-400" style={{ width: `${(v / predMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Unusual spending */}
        <Card title="Unusual spending" icon={AlertTriangle}>
          {unusual.length === 0 ? (
            <EmptyState icon={Receipt} title="Nothing unusual" text="Zenty flags expenses that are much bigger than your normal for that category." />
          ) : (
            <ul className="-mx-2 divide-y divide-line">
              {unusual.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-2 py-3">
                  <CategoryTile name={t.category} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{t.description || t.category}</p>
                    <p className="text-xs text-gray-500">{t.category} · {t.date ? relativeDay(t.date) : ''}</p>
                  </div>
                  <Money value={t.amount} className="text-sm font-semibold text-ink" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
