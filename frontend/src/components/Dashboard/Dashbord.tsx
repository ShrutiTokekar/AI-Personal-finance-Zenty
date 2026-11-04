// frontend/src/components/Dashboard/Dashbord.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Leaf,
  Lightbulb,
  PiggyBank,
  Receipt,
  Repeat,
  Sun,
  Target,
  Wallet,
} from 'lucide-react';
import { overviewAPI, type Overview, type User } from '../../services/api';
import SpendingCalendar from '../SpendingCalendar';
import { Card, CategoryTile, EmptyState, Money, Progress, ScoreRing, Spinner, formatMoney, relativeDay } from '../ui';

interface Props {
  user: User;
  onNavigate: (tab: string) => void;
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const monthName = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: 'short' });
};

/* ---------- Trend tooltip ---------- */
function TrendTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 shadow-lift">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold text-ink"><Money value={payload[0].value} /></p>
    </div>
  );
}

export default function Dashboard({ user, onNavigate }: Props) {
  const [data, setData] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await overviewAPI.get();
      setData(r.data);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('zenty:data-changed', load);
    return () => window.removeEventListener('zenty:data-changed', load);
  }, [load]);

  const trend = useMemo(() => (data?.trends || []).map((t) => ({ name: monthName(t.month), amount: t.amount })), [data]);

  if (failed && !data) {
    return (
      <div className="card p-10 text-center">
        <p className="font-semibold text-ink">Couldn't load your dashboard.</p>
        <button onClick={load} className="btn-ghost mt-4">Try again</button>
      </div>
    );
  }
  if (!data) return <Spinner />;

  const s = data.summary;
  const first = (user.name || '').split(' ')[0];
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthPct = Math.round((now.getDate() / daysInMonth) * 100);
  const isNew = data.recent.length === 0;
  const topCat = data.categories[0]?.amount || 0;

  const checklist = [
    { done: data.recent.length > 0, label: 'Log your first transaction', hint: 'Try the quick-add bar above', tab: 'transactions' },
    { done: data.budgets.length > 0, label: 'Set a monthly budget', hint: 'Know what you can spend', tab: 'budget' },
    { done: data.goals.length > 0, label: 'Create a savings goal', hint: 'A trip, a car, a safety net', tab: 'savings' },
    { done: user.email_verified, label: 'Verify your email', hint: 'Unlocks bank sync & alerts', tab: 'settings' },
    { done: data.net_worth.linked_accounts > 0, label: 'Link a bank account', hint: 'Import transactions automatically', tab: 'bank' },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-ink">
            {greeting()}{first ? `, ${first}` : ''}.
          </h1>
        </div>
        <div className="w-full sm:w-64">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{now.toLocaleDateString(undefined, { month: 'long' })}</span>
            <span>{daysInMonth - now.getDate()} days left</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-ink" style={{ width: `${monthPct}%` }} />
          </div>
        </div>
      </div>

      {/* Getting started */}
      {doneCount < checklist.length && (
        <Card className="!p-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
            <div>
              <h2 className="font-semibold text-ink">Get set up</h2>
              <p className="text-sm text-gray-500">{doneCount} of {checklist.length} done. Each step makes your Zen Score smarter.</p>
            </div>
            <div className="flex gap-1">
              {checklist.map((c, i) => <span key={i} className={`h-1.5 w-6 rounded-full ${c.done ? 'bg-primary-500' : 'bg-line'}`} />)}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5">
            {checklist.map((c) => (
              <button
                key={c.label}
                onClick={() => onNavigate(c.tab)}
                disabled={c.done}
                className="group flex items-start gap-3 border-line px-5 py-4 text-left transition hover:bg-gray-50 disabled:hover:bg-transparent lg:border-r last:border-r-0"
              >
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${c.done ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-300'}`}>
                  {c.done && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span>
                  <span className={`block text-sm font-medium ${c.done ? 'text-gray-400 line-through' : 'text-ink'}`}>{c.label}</span>
                  {!c.done && <span className="block text-xs text-gray-500">{c.hint}</span>}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Hero row */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Zen Score */}
        <section className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white shadow-lift lg:col-span-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary-500/20 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Leaf className="h-4 w-4 text-matcha-300" /> Zen Score</h2>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-saffron-300">{data.zen.label}</span>
          </div>
          <div className="relative mt-5 flex flex-col items-center gap-6 sm:flex-row">
            <ScoreRing score={data.zen.score}>
              <span className="font-display text-5xl font-semibold leading-none">{data.zen.score}</span>
              <span className="mt-1 text-xs text-white/50">out of 100</span>
            </ScoreRing>
            <ul className="w-full flex-1 space-y-3">
              {data.zen.factors.map((f) => (
                <li key={f.key} title={f.tip}>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/70">{f.label}</span>
                    <span className="num font-semibold">{f.points}/{f.max}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-saffron-300 to-primary-300 transition-all duration-700" style={{ width: `${(f.points / f.max) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-white/45">{f.tip}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Safe to spend */}
        <section className="card flex flex-col p-6 lg:col-span-3">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><Sun className="h-4 w-4 text-saffron-500" /> Safe to spend today</h2>
          <p className="mt-6 font-display text-5xl font-semibold tracking-tight text-ink"><Money value={data.safe_to_spend.daily} cents={false} /></p>
          <p className="mt-2 text-sm text-gray-500">
            <Money value={data.safe_to_spend.remaining} cents={false} /> left over {data.safe_to_spend.days_left} day{data.safe_to_spend.days_left === 1 ? '' : 's'}
          </p>
          <p className="mt-auto pt-6 text-xs text-gray-400">{data.safe_to_spend.basis}.</p>
        </section>

        {/* This month */}
        <section className="card p-6 lg:col-span-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><CalendarDays className="h-4 w-4 text-gray-400" /> This month</h2>
          <dl className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-sm text-gray-500"><ArrowDownRight className="h-4 w-4 text-primary-600" /> Money in</dt>
              <dd className="font-display text-xl font-semibold text-ink"><Money value={s.total_income} /></dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-sm text-gray-500"><ArrowUpRight className="h-4 w-4 text-red-500" /> Money out</dt>
              <dd className="font-display text-xl font-semibold text-ink"><Money value={s.total_expenses} /></dd>
            </div>
            <div className="border-t border-line pt-4 flex items-center justify-between">
              <dt className="text-sm font-medium text-ink">Kept</dt>
              <dd className={`font-display text-2xl font-semibold ${s.net_savings >= 0 ? 'text-primary-700' : 'text-red-600'}`}>
                <Money value={s.net_savings} />
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-primary-50 px-2.5 py-1 font-semibold text-primary-700">{s.savings_rate.toFixed(0)}% saved</span>
            {s.expense_change !== 0 && (
              <span className={`rounded-full px-2.5 py-1 font-semibold ${s.expense_change > 0 ? 'bg-red-50 text-red-700' : 'bg-primary-50 text-primary-700'}`}>
                Spending {s.expense_change > 0 ? 'up' : 'down'} {Math.abs(s.expense_change).toFixed(0)}% vs last month
              </span>
            )}
          </div>
        </section>
      </div>

      {/* Today's insight */}
      {(() => {
        const weakest = [...data.zen.factors].sort((a, b) => a.points / a.max - b.points / b.max)[0];
        return weakest && weakest.points < weakest.max ? (
          <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-lilac-200 bg-lilac-50 px-6 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-lilac-500 text-white"><Lightbulb className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lilac-600">Today's insight · {weakest.label}</p>
              <p className="mt-0.5 text-sm text-ink">{weakest.tip} Improving this adds up to {weakest.max - weakest.points} points to your Zen Score.</p>
            </div>
          </div>
        ) : null;
      })()}

      {/* Trend + calendar */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card title="Monthly spending" icon={BarChart3} className="lg:col-span-8"
          action={<span className="text-xs text-gray-400">Last 6 months</span>}>
          {trend.length === 0 ? (
            <EmptyState icon={BarChart3} title="No spending yet" text="Your month-by-month spending will appear here." />
          ) : (
            <div className="h-64" role="img" aria-label="Bar chart of monthly spending">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="#ece5d3" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#7a746b', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a8a197', fontSize: 11 }}
                    tickFormatter={(v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)} />
                  <Tooltip content={<TrendTip />} cursor={{ fill: 'rgba(31,43,24,0.04)' }} />
                  <Bar dataKey="amount" fill="#6c914c" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Spending calendar" icon={CalendarDays} className="lg:col-span-4">
          <SpendingCalendar days={data.daily} />
        </Card>
      </div>

      {/* Categories, budgets, goals */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Where it went" icon={Receipt} action={<span className="text-xs text-gray-400">This month</span>}>
          {data.categories.length === 0 ? (
            <EmptyState icon={Receipt} title="Nothing spent yet" text="Top categories show up as you spend." />
          ) : (
            <ul className="space-y-4">
              {data.categories.slice(0, 5).map((c) => (
                <li key={c.category}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">{c.category}</span>
                    <span className="text-gray-600"><Money value={c.amount} cents={false} /></span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${(c.amount / topCat) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Budgets" icon={Wallet}
          action={<button onClick={() => onNavigate('budget')} className="flex items-center text-xs font-semibold text-primary-700 hover:text-primary-900">Manage <ChevronRight className="h-3.5 w-3.5" /></button>}>
          {data.budgets.length === 0 ? (
            <EmptyState icon={Wallet} title="No budgets yet" action={<button onClick={() => onNavigate('budget')} className="btn-ghost">Set a budget</button>} />
          ) : (
            <ul className="space-y-4">
              {data.budgets.map((b) => (
                <li key={b.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">{b.category}</span>
                    <span className="text-gray-500">
                      <Money value={b.current_spent} cents={false} className="text-ink font-medium" /> / <Money value={b.monthly_limit} cents={false} />
                    </span>
                  </div>
                  <Progress value={b.current_spent} max={b.monthly_limit} className="mt-1.5" />
                  {b.remaining < 0 && <p className="mt-1 text-xs font-medium text-red-600">Over by {formatMoney(-b.remaining, { cents: false })}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Goals" icon={Target}
          action={<button onClick={() => onNavigate('savings')} className="flex items-center text-xs font-semibold text-primary-700 hover:text-primary-900">All goals <ChevronRight className="h-3.5 w-3.5" /></button>}>
          {data.goals.length === 0 ? (
            <EmptyState icon={PiggyBank} title="No goals yet" action={<button onClick={() => onNavigate('savings')} className="btn-ghost">Create a goal</button>} />
          ) : (
            <ul className="space-y-4">
              {data.goals.map((g) => (
                <li key={g.id} className="flex items-center gap-3">
                  <ScoreMini pct={g.progress} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{g.name}</p>
                    <p className="text-xs text-gray-500">
                      <Money value={g.current_amount} cents={false} /> of <Money value={g.target_amount} cents={false} />
                      {g.deadline && ` · by ${new Date(g.deadline).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Recent + subscriptions */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card title="Recent activity" icon={Receipt} className="lg:col-span-8"
          action={<button onClick={() => onNavigate('transactions')} className="flex items-center text-xs font-semibold text-primary-700 hover:text-primary-900">See all <ChevronRight className="h-3.5 w-3.5" /></button>}>
          {isNew ? (
            <EmptyState icon={Receipt} title="No transactions yet" text='Type "spent 12 on lunch" in the bar at the top, or add one manually.'
              action={<button onClick={() => onNavigate('transactions')} className="btn-primary">Add a transaction</button>} />
          ) : (
            <ul className="-mx-2 divide-y divide-line">
              {data.recent.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-2 py-3">
                  <CategoryTile name={t.category} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{t.description || t.category}</p>
                    <p className="text-xs text-gray-500">{t.category} · {t.date ? relativeDay(t.date) : ''}{t.source === 'bank' ? ' · Bank' : ''}</p>
                  </div>
                  <Money value={t.type === 'income' ? t.amount : -t.amount} sign
                    className={`text-sm font-semibold ${t.type === 'income' ? 'text-primary-700' : 'text-ink'}`} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Subscriptions" icon={Repeat} className="lg:col-span-4 border-lilac-100"
          action={data.recurring.items.length > 0 ? <span className="text-xs text-gray-500"><Money value={data.recurring.monthly_total} cents={false} />/mo</span> : undefined}>
          {data.recurring.items.length === 0 ? (
            <EmptyState icon={Repeat} title="None detected yet" text="Zenty spots repeating monthly charges automatically after a couple of months." />
          ) : (
            <ul className="space-y-3">
              {data.recurring.items.map((r) => (
                <li key={r.name} className="flex items-center gap-3">
                  <CategoryTile name={r.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{r.name}</p>
                    <p className="text-xs text-gray-500">Next ~{new Date(r.next_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                  </div>
                  <Money value={r.amount} className="text-sm font-semibold text-ink" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function ScoreMini({ pct }: { pct: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct)) / 100;
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90" aria-hidden="true">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#ece5d3" strokeWidth="4" />
        <circle cx="20" cy="20" r={r} fill="none" stroke="#6c914c" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-[10px] font-bold text-ink">{Math.round(pct)}%</span>
    </div>
  );
}
