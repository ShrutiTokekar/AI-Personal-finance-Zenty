import type { Overview } from '../services/api';
import { Money, formatMoney } from './ui';

/* ---------- Spending calendar (sequential, single hue) ---------- */
const HEAT = ['bg-gray-100', 'bg-primary-100', 'bg-primary-200', 'bg-primary-400', 'bg-primary-600'];

export default function SpendingCalendar({ days, detailed = false }: { days: Overview['daily']; detailed?: boolean }) {
  const now = new Date();
  const firstWeekday = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const max = Math.max(0, ...days.map((d) => d.amount));
  const level = (a: number) => (a <= 0 ? 0 : Math.min(4, Math.ceil((a / max) * 4)));
  const total = days.reduce((s, d) => s + d.amount, 0);
  const spendDays = days.filter((d) => d.amount > 0).length;
  return (
    <div>
      <div className={`grid grid-cols-7 text-center text-[11px] font-medium text-gray-400 ${detailed ? 'gap-2' : 'gap-1.5'}`}>
        {(detailed ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className={`mt-1.5 grid grid-cols-7 ${detailed ? 'gap-2' : 'gap-1.5'}`}>
        {Array.from({ length: firstWeekday }).map((_, i) => <span key={`b${i}`} />)}
        {days.map((d) => {
          const label = `${now.toLocaleDateString(undefined, { month: 'short' })} ${d.day}: ${d.future ? 'upcoming' : formatMoney(d.amount)}`;
          const lv = level(d.amount);
          return (
            <span
              key={d.day}
              title={label}
              aria-label={label}
              className={`group relative rounded-md ${detailed ? 'flex aspect-[1/0.85] flex-col justify-between p-1.5 sm:p-2' : 'aspect-square'} ${d.future ? 'border border-dashed border-line bg-transparent' : HEAT[lv]} ${
                d.day === now.getDate() ? 'ring-2 ring-saffron-400 ring-offset-1' : ''
              }`}
            >
              {detailed && (
                <>
                  <span className={`text-[11px] font-semibold ${lv >= 3 ? 'text-white/90' : 'text-gray-500'}`}>{d.day}</span>
                  {!d.future && d.amount > 0 && (
                    <span className={`amount num hidden truncate text-[11px] font-semibold sm:block ${lv >= 3 ? 'text-white' : 'text-ink'}`}>
                      {formatMoney(d.amount, { cents: false })}
                    </span>
                  )}
                </>
              )}
            </span>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <span>
          {spendDays} spending day{spendDays === 1 ? '' : 's'} · <Money value={total} cents={false} />
        </span>
        <span className="flex items-center gap-1">
          Less {HEAT.map((c) => <span key={c} className={`h-2.5 w-2.5 rounded-sm ${c}`} />)} More
        </span>
      </div>
    </div>
  );
}

