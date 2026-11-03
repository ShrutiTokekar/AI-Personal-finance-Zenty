import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';

/* ---------- formatting ---------- */

export function formatMoney(n: number | null | undefined, opts: { cents?: boolean; currency?: string; sign?: boolean } = {}) {
  if (n == null || Number.isNaN(n)) return '—';
  const { cents = true, currency = 'USD', sign = false } = opts;
  const s = Math.abs(n).toLocaleString(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  if (sign) return (n >= 0 ? '+' : '−') + s;
  return n < 0 ? '−' + s : s;
}

/** An amount that blurs when privacy mode is on. */
export function Money({ value, className = '', ...opts }: { value: number | null | undefined; className?: string; cents?: boolean; currency?: string; sign?: boolean }) {
  return <span className={`amount num ${className}`}>{formatMoney(value, opts)}</span>;
}

/* ---------- layout ---------- */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = '', title, action, icon: Icon }: {
  children: ReactNode; className?: string; title?: string; action?: ReactNode; icon?: LucideIcon;
}) {
  return (
    <section className={`card p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-5 flex items-center justify-between gap-3">
          {title && (
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              {Icon && <Icon className="h-4 w-4 text-gray-400" />}
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'neutral' }: {
  label: string; value: ReactNode; hint?: ReactNode; icon: LucideIcon; tone?: 'neutral' | 'good' | 'bad' | 'accent' | 'insight';
}) {
  const tones = {
    neutral: 'bg-gray-100 text-gray-600',
    good: 'bg-primary-50 text-primary-600',
    bad: 'bg-red-50 text-red-600',
    accent: 'bg-saffron-50 text-saffron-600',
    insight: 'bg-lilac-50 text-lilac-600',
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-display text-[28px] leading-none font-semibold text-ink">{value}</p>
      {hint && <p className="mt-2 text-sm text-gray-500">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
        <Icon className="h-6 w-6 text-gray-400" />
      </span>
      <p className="mt-3 font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-gray-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex justify-center py-16 ${className}`}>
      <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
    </div>
  );
}

/* ---------- data display ---------- */

/** Thin progress bar. Turns matcha near the limit and red past it. */
export function Progress({ value, max, className = '' }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const color = pct > 100 ? 'bg-red-500' : pct >= 85 ? 'bg-matcha-400' : 'bg-primary-500';
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-gray-100 ${className}`} role="progressbar"
      aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

/** Circular score ring (0-100). */
export function ScoreRing({ score, size = 148, stroke = 12, children }: { score: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-white/10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#zenGrad)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset 1s ease' }} />
        <defs>
          <linearGradient id="zenGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f7c95e" />
            <stop offset="100%" stopColor="#a3c081" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'accent' }) {
  const tones = {
    neutral: 'bg-gray-100 text-gray-600',
    good: 'bg-primary-50 text-primary-700',
    bad: 'bg-red-50 text-red-700',
    accent: 'bg-saffron-50 text-saffron-600',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

/** Category initial in a soft tile; color is derived from the name so it stays stable. */
const TILE_COLORS = ['bg-primary-50 text-primary-700', 'bg-matcha-50 text-matcha-600', 'bg-sky-50 text-sky-700',
  'bg-rose-50 text-rose-700', 'bg-lilac-50 text-lilac-700', 'bg-lime-50 text-lime-700'];
export function CategoryTile({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const dims = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl font-bold ${dims} ${TILE_COLORS[h % TILE_COLORS.length]}`}>
      {(name || '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function relativeDay(iso: string) {
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z');
  const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Zenty logo mark. */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return <img src="/zenty-logo.png" alt="Zenty" className={`${className} shrink-0 rounded-[24%] object-cover ring-1 ring-black/5`} />;
}

/** Full lockup: mark + wordmark. */
export function LogoFull({ className = '', light = true }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark className="h-12 w-12" />
      <span className={`font-display text-4xl font-semibold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>Zenty</span>
    </span>
  );
}
