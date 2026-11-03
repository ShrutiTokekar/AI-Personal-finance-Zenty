import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, PiggyBank, Sun } from 'lucide-react';

/**
 * A rake slowly draws three solid winding lines across the green. Glowing
 * nodes appear along the way, each opening a small animated widget for a
 * Zenty feature. Decorative (aria-hidden).
 */

const VW = 600;
const VH = 760;
const CENTER = 'M 250 800 C 250 660, 470 640, 445 505 S 115 365, 160 245 S 365 95, 335 -20';
const DRAW_MS = 9000;
const HOLD_MS = 6500;
const FADE_MS = 900;
const SAMPLES = 260;
const widthAt = (t: number) => 60 - 42 * t; // wide near the viewer, narrow in the distance

type Feature = 'piggy' | 'stock' | 'week' | 'budget' | 'safe';
const PINS: { t: number; feature: Feature }[] = [
  { t: 0.1, feature: 'piggy' },
  { t: 0.3, feature: 'stock' },
  { t: 0.5, feature: 'week' },
  { t: 0.7, feature: 'budget' },
  { t: 0.88, feature: 'safe' },
];

/* ---------------------------------------------------------------- */
/* Feature widgets                                                   */
/* ---------------------------------------------------------------- */

const card = 'rounded-2xl border border-white/70 bg-[#fbf8ee]/95 p-3 text-ink shadow-[0_18px_40px_-18px_rgba(31,43,24,0.55)] backdrop-blur';
const eyebrow = 'text-[0.7em] font-semibold uppercase tracking-[0.12em] text-gray-500';

function Counter({ to, prefix = '' }: { to: number; prefix?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const s = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - s) / 1100);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{prefix}{n}</>;
}

function PiggyWidget() {
  return (
    <div className={card}>
      <div className="flex items-center gap-3">
        <div className="relative h-[3em] w-[3em] shrink-0">
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className="absolute left-1/2 top-0 h-[0.75em] w-[0.75em] -translate-x-1/2 rounded-full border border-saffron-600/40 bg-saffron-300"
              initial={{ y: -14, opacity: 0 }} animate={{ y: [-14, 10], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.9, delay: 0.3 + i * 0.55, repeat: Infinity, repeatDelay: 1.2, times: [0, 0.2, 0.8, 1] }} />
          ))}
          <PiggyBank className="absolute bottom-0 left-0 h-[3em] w-[3em] text-primary-600" strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={eyebrow}>Kyoto trip</p>
          <p className="num font-semibold"><span className="text-saffron-600">+$50</span> saved</p>
        </div>
      </div>
      <div className="mt-2.5 h-[0.4em] overflow-hidden rounded-full bg-primary-100">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-saffron-400 to-primary-500"
          initial={{ width: '48%' }} animate={{ width: '62%' }} transition={{ delay: 0.6, duration: 1.4, ease: 'easeOut' }} />
      </div>
      <p className="num mt-1 text-[0.75em] text-gray-500">$1,850 of $3,000</p>
    </div>
  );
}

function StockWidget() {
  const pts = [14, 16, 15, 18, 17, 21, 20, 24, 26, 30];
  const w = 120, h = 38;
  const min = Math.min(...pts), max = Math.max(...pts);
  const xy = pts.map((p, i) => [(i / (pts.length - 1)) * w, h - ((p - min) / (max - min)) * (h - 4) - 2]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  return (
    <div className={card}>
      <div className="flex items-baseline justify-between gap-2">
        <p className={eyebrow}>AAPL · Apple</p>
        <span className="num flex items-center text-[0.8em] font-semibold text-lilac-600"><ArrowUpRight className="h-[1em] w-[1em]" />2.14%</span>
      </div>
      <p className="num font-semibold">$<Counter to={232} />.18</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-[2.6em] w-full overflow-visible">
        <defs>
          <linearGradient id="rrStock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8564d6" stopOpacity="0.25" />
            <stop offset="1" stopColor="#8564d6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path d={`${d}L${w} ${h}L0 ${h}Z`} fill="url(#rrStock)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} />
        <motion.path d={d} fill="none" stroke="#8564d6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.2, duration: 1.3, ease: 'easeOut' }} />
      </svg>
    </div>
  );
}

function WeekWidget() {
  const days = [40, 65, 30, 80, 55, 95, 45];
  return (
    <div className={card}>
      <div className="flex items-baseline justify-between">
        <p className={eyebrow}>This week</p>
        <p className="num text-[0.85em] font-semibold">$<Counter to={412} /></p>
      </div>
      <div className="mt-2 flex h-[3.2em] items-end gap-[0.35em]">
        {days.map((v, i) => (
          <motion.div key={i} className={`flex-1 rounded-t-[3px] ${i === 5 ? 'bg-saffron-400' : 'bg-primary-400'}`}
            initial={{ height: 0 }} animate={{ height: `${v}%` }} transition={{ delay: 0.15 + i * 0.08, type: 'spring', stiffness: 140, damping: 16 }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[0.65em] font-medium text-gray-400">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="flex-1 text-center">{d}</span>)}
      </div>
    </div>
  );
}

function BudgetWidget() {
  const r = 16, c = 2 * Math.PI * r;
  return (
    <div className={`${card} flex items-center gap-3`}>
      <svg viewBox="0 0 40 40" className="h-[3em] w-[3em] shrink-0 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#e1ebd4" strokeWidth="4" />
        <motion.circle cx="20" cy="20" r={r} fill="none" stroke="#6c914c" strokeWidth="4" strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * 0.38 }} transition={{ delay: 0.2, duration: 1.3, ease: 'easeOut' }} />
      </svg>
      <div className="min-w-0">
        <p className={eyebrow}>Groceries budget</p>
        <p className="num font-semibold"><Counter to={62} />% used</p>
        <p className="num text-[0.75em] text-primary-700">$228 left · on track</p>
      </div>
    </div>
  );
}

function SafeWidget() {
  return (
    <div className={`${card} flex items-center gap-3`}>
      <span className="flex h-[2.6em] w-[2.6em] shrink-0 items-center justify-center rounded-xl bg-saffron-50">
        <Sun className="h-[1.3em] w-[1.3em] text-saffron-500" strokeWidth={1.8} />
      </span>
      <div>
        <p className={eyebrow}>Safe to spend today</p>
        <p className="num font-display text-[1.6em] font-semibold leading-none text-ink"><Counter to={48} prefix="$" /></p>
      </div>
    </div>
  );
}

const WIDGET: Record<Feature, () => ReactElement> = {
  piggy: PiggyWidget, stock: StockWidget, week: WeekWidget, budget: BudgetWidget, safe: SafeWidget,
};

/* ---------------------------------------------------------------- */
/* Road                                                              */
/* ---------------------------------------------------------------- */

interface Geo {
  left: string;
  right: string;
  pins: { x: number; y: number; side: 'left' | 'right'; feature: Feature; t: number }[];
}

export default function RakeRoad() {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<SVGPathElement>(null);
  const maskRef = useRef<SVGPathElement>(null);
  const roadRef = useRef<SVGGElement>(null);
  const rakeRef = useRef<SVGGElement>(null);
  const headRef = useRef<SVGLineElement>(null);
  const tineRefs = useRef<(SVGLineElement | null)[]>([]);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [revealed, setRevealed] = useState<number>(-1);
  const [cycle, setCycle] = useState(0);
  const [compact, setCompact] = useState(false);

  // On small screens show fewer widgets so they don't crowd the road.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCompact(e.contentRect.width < 420));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build the three road lines from the centre curve.
  useLayoutEffect(() => {
    const path = guideRef.current;
    if (!path) return;
    const L = path.getTotalLength();
    const pts = Array.from({ length: SAMPLES + 1 }, (_, i) => {
      const t = i / SAMPLES;
      const p = path.getPointAtLength(L * t);
      const q = path.getPointAtLength(Math.min(L, L * t + 1));
      const r = path.getPointAtLength(Math.max(0, L * t - 1));
      const dx = q.x - r.x, dy = q.y - r.y;
      const len = Math.hypot(dx, dy) || 1;
      return { t, x: p.x, y: p.y, nx: -dy / len, ny: dx / len };
    });
    const line = (k: number) => pts.map((p, i) => `${i ? 'L' : 'M'}${(p.x + p.nx * widthAt(p.t) * k).toFixed(1)} ${(p.y + p.ny * widthAt(p.t) * k).toFixed(1)}`).join('');
    const pins = PINS.map(({ t, feature }) => {
      const p = path.getPointAtLength(L * t);
      return { x: p.x, y: p.y, side: (p.x >= VW / 2 ? 'left' : 'right') as 'left' | 'right', feature, t };
    });
    setGeo({ left: line(1), right: line(-1), pins });
  }, []);

  useEffect(() => {
    if (!geo) return;
    const path = guideRef.current!;
    const mask = maskRef.current!;
    const L = path.getTotalLength();
    mask.setAttribute('stroke-dasharray', String(L));

    if (reduce) {
      mask.setAttribute('stroke-dashoffset', '0');
      setRevealed(PINS.length - 1);
      return;
    }

    let raf = 0, start = performance.now(), running = true, lastPin = -1, c = 0;
    const total = DRAW_MS + HOLD_MS + FADE_MS;
    const frame = (now: number) => {
      if (!running) return;
      let t = now - start;
      if (t > total) {
        start = now; t = 0; lastPin = -1; c += 1;
        setRevealed(-1); setCycle(c);
      }
      const p = Math.min(1, t / DRAW_MS);
      mask.setAttribute('stroke-dashoffset', String(L * (1 - p)));
      const fade = t > DRAW_MS + HOLD_MS ? Math.max(0, 1 - (t - DRAW_MS - HOLD_MS) / FADE_MS) : 1;
      roadRef.current?.setAttribute('opacity', String(fade));

      let pinIdx = -1;
      PINS.forEach((pin, i) => { if (p >= pin.t) pinIdx = i; });
      if (pinIdx !== lastPin) { lastPin = pinIdx; setRevealed(pinIdx); }

      const rake = rakeRef.current;
      if (rake) {
        if (p < 1) {
          const at = L * p;
          const pt = path.getPointAtLength(at);
          const ahead = path.getPointAtLength(Math.min(L, at + 2));
          const ang = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
          const w = widthAt(p);
          rake.setAttribute('transform', `translate(${pt.x} ${pt.y}) rotate(${ang})`);
          headRef.current?.setAttribute('y1', String(-w - 10));
          headRef.current?.setAttribute('y2', String(w + 10));
          [-w, 0, w].forEach((y, i) => {
            const tine = tineRefs.current[i];
            if (tine) { tine.setAttribute('y1', String(y)); tine.setAttribute('y2', String(y)); }
          });
          rake.setAttribute('opacity', String(Math.min(1, p * 30, (1 - p) * 30)));
        } else {
          rake.setAttribute('opacity', '0');
        }
      }
      raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) { running = true; raf = requestAnimationFrame(frame); }
      else if (!e.isIntersecting) { running = false; cancelAnimationFrame(raf); }
    });
    if (wrapRef.current) io.observe(wrapRef.current);
    raf = requestAnimationFrame(frame);
    return () => { running = false; cancelAnimationFrame(raf); io.disconnect(); };
  }, [geo, reduce]);

  const pins = useMemo(() => geo?.pins || [], [geo]);

  return (
    <div ref={wrapRef} className="relative mx-auto aspect-[600/760] w-full max-w-[460px] lg:max-w-[min(500px,calc((100svh-150px)*0.79))] text-[12px] sm:text-[13px]" aria-hidden="true">
      <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <mask id="rrReveal" maskUnits="userSpaceOnUse" x="-50" y="-50" width={VW + 100} height={VH + 120}>
            <path ref={maskRef} d={CENTER} fill="none" stroke="#fff" strokeWidth="190" strokeLinecap="butt" />
          </mask>
          <filter id="rrSoft"><feGaussianBlur stdDeviation="3" /></filter>
        </defs>
        <path ref={guideRef} d={CENTER} fill="none" stroke="none" />
        {geo && (
          <g ref={roadRef} mask="url(#rrReveal)">
            {[geo.left, CENTER, geo.right].map((d, i) => (
              <g key={i}>
                <path d={d} fill="none" stroke="#1f2b18" strokeOpacity="0.16" strokeWidth="6" transform="translate(2 3)" filter="url(#rrSoft)" />
                <path d={d} fill="none" stroke="#f6f2e2" strokeWidth="4.5" strokeLinecap="round" />
              </g>
            ))}
          </g>
        )}
        {/* the rake: three tines on the three lines, handle reaching ahead */}
        <g ref={rakeRef} opacity="0">
          <line x1="2" y1="0" x2="120" y2="-90" stroke="#1f2b18" strokeOpacity="0.25" strokeWidth="6" strokeLinecap="round" filter="url(#rrSoft)" transform="translate(3 5)" />
          <line x1="2" y1="0" x2="120" y2="-90" stroke="#f6f2e2" strokeWidth="3.2" strokeLinecap="round" />
          <line ref={headRef} x1="0" y1="-60" x2="0" y2="60" stroke="#f6f2e2" strokeWidth="5" strokeLinecap="round" />
          {[0, 1, 2].map((i) => (
            <line key={i} ref={(el) => { tineRefs.current[i] = el; }} x1="-9" x2="0" y1="0" y2="0" stroke="#f6f2e2" strokeWidth="3" strokeLinecap="round" />
          ))}
        </g>
      </svg>

      {/* Pins and their feature widgets */}
      <AnimatePresence>
        {pins.map((pin, i) => {
          if (i > revealed) return null;
          const Widget = WIDGET[pin.feature];
          const xPct = (pin.x / VW) * 100;
          const yPct = (pin.y / VH) * 100;
          return (
            <div key={`${cycle}-${i}`}>
              <motion.div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${xPct}%`, top: `${yPct}%` }}
                initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.4 } }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
                <span className="relative flex h-5 w-5 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-saffron-300/50" style={{ animationDuration: '2.2s' }} />
                  <span className="absolute inset-0 rounded-full bg-[#f6f2e2] shadow-[0_2px_8px_rgba(31,43,24,0.35)]" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-saffron-500" />
                </span>
              </motion.div>
              {!(compact && (pin.feature === 'budget' || pin.feature === 'safe')) && (
                <motion.span className="absolute z-[5] h-[1.5px] bg-[#f6f2e2]/80"
                  style={pin.side === 'right' ? { left: `calc(${xPct}% + 10px)`, top: `${yPct}%`, width: 14, originX: 0 } : { right: `calc(${100 - xPct}% + 10px)`, top: `${yPct}%`, width: 14, originX: 1 }}
                  initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.15, duration: 0.3 }} />
              )}
              {!(compact && (pin.feature === 'budget' || pin.feature === 'safe')) && <motion.div className="absolute z-20 w-[47%] -translate-y-1/2"
                style={pin.side === 'right' ? { left: `calc(${xPct}% + 24px)`, top: `${yPct}%` } : { right: `calc(${100 - xPct}% + 24px)`, top: `${yPct}%` }}
                initial={{ opacity: 0, x: pin.side === 'right' ? -10 : 10, scale: 0.92 }} animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.4 } }} transition={{ delay: 0.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
                <Widget />
              </motion.div>}
            </div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
