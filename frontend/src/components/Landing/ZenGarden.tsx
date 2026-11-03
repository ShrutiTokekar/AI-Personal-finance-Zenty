import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Coffee, Landmark, PiggyBank, Repeat, ShoppingBag, Sun } from 'lucide-react';

/**
 * Animated zen garden: a slim rake draws grooves through moonlit sand, and each
 * finished groove reveals a small live widget (a stock rising, a transaction,
 * a budget filling...). Purely decorative (aria-hidden).
 */

const W = 1440;
const H = 820;
const LINES = 6;
const TINES = 4;
const TINE_GAP = 6;
const DRAW_MS = 2400;
const PAUSE_MS = 250;
const HOLD_MS = 5000;
const FADE_MS = 1000;

/* ---------------------------------------------------------------- */
/* Widgets                                                           */
/* ---------------------------------------------------------------- */

type WidgetSpec =
  | { kind: 'stock'; ticker: string; name: string; price: string; change: string; points: number[] }
  | { kind: 'txn'; merchant: string; category: string; amount: string; icon: 'coffee' | 'shop' }
  | { kind: 'budget'; category: string; pct: number; left: string }
  | { kind: 'goal'; name: string; saved: string; target: string; pct: number }
  | { kind: 'safe'; amount: number }
  | { kind: 'sub'; name: string; when: string; amount: string }
  | { kind: 'income'; source: string; amount: string };

const WIDGETS: WidgetSpec[] = [
  { kind: 'stock', ticker: 'AAPL', name: 'Apple Inc.', price: '$232.18', change: '+2.14%', points: [12, 14, 13, 16, 15, 19, 18, 22, 24, 27] },
  { kind: 'txn', merchant: 'Blue Bottle Coffee', category: 'Food & Dining', amount: '−$4.50', icon: 'coffee' },
  { kind: 'budget', category: 'Groceries', pct: 62, left: '$228 left' },
  { kind: 'goal', name: 'Kyoto trip', saved: '$1,850', target: '$3,000', pct: 62 },
  { kind: 'safe', amount: 48 },
  { kind: 'sub', name: 'Netflix', when: 'Renews Friday', amount: '$15.99' },
  { kind: 'income', source: 'Paycheck', amount: '+$2,400.00' },
  { kind: 'stock', ticker: 'NVDA', name: 'NVIDIA', price: '$184.02', change: '+3.80%', points: [10, 11, 10, 13, 15, 14, 18, 21, 20, 25] },
  { kind: 'txn', merchant: 'Whole Foods Market', category: 'Groceries', amount: '−$62.30', icon: 'shop' },
  { kind: 'budget', category: 'Dining out', pct: 85, left: '$45 left' },
  { kind: 'goal', name: 'Emergency fund', saved: '$4,000', target: '$10,000', pct: 40 },
  { kind: 'stock', ticker: 'VOO', name: 'S&P 500 ETF', price: '$598.40', change: '+0.92%', points: [18, 18, 19, 18, 20, 21, 21, 22, 23, 24] },
];

function Sparkline({ points }: { points: number[] }) {
  const w = 84, h = 30;
  const min = Math.min(...points), max = Math.max(...points);
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - ((p - min) / (max - min || 1)) * (h - 4) - 2]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id="spkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfaaf0" stopOpacity="0.3" />
          <stop offset="1" stopColor="#bfaaf0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={`${d}L${w} ${h}L0 ${h}Z`} fill="url(#spkFill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.6 }} />
      <motion.path d={d} fill="none" stroke="#bfaaf0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 1.2, ease: 'easeOut' }} />
      <motion.circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="2.4" fill="#bfaaf0"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} />
    </svg>
  );
}

function Counter({ to, prefix = '' }: { to: number; prefix?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1000);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{prefix}{n}</>;
}

const shell = 'flex h-full w-full items-center gap-3 rounded-[14px] border border-white/[0.09] bg-[#0d1f1a]/75 px-3.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.75)] ring-1 ring-inset ring-white/[0.03] backdrop-blur-xl';
const eyebrow = 'text-[0.68em] font-medium uppercase tracking-[0.14em] text-white/40';
const iconBox = 'flex h-[2.3em] w-[2.3em] shrink-0 items-center justify-center rounded-[10px] border border-white/[0.08] bg-white/[0.04]';

function Widget({ spec }: { spec: WidgetSpec }) {
  switch (spec.kind) {
    case 'stock':
      return (
        <div className={shell}>
          <div className="min-w-0 flex-1">
            <p className={eyebrow}>{spec.ticker} · {spec.name}</p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="num font-semibold text-white">{spec.price}</span>
              <span className="num flex items-center text-[0.8em] font-medium text-lilac-300"><ArrowUpRight className="h-[1em] w-[1em]" />{spec.change}</span>
            </div>
          </div>
          <Sparkline points={spec.points} />
        </div>
      );
    case 'txn':
      return (
        <div className={shell}>
          <span className={iconBox}>
            {spec.icon === 'coffee' ? <Coffee className="h-[1.1em] w-[1.1em] text-white/70" strokeWidth={1.75} /> : <ShoppingBag className="h-[1.1em] w-[1.1em] text-white/70" strokeWidth={1.75} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-white/90">{spec.merchant}</p>
            <p className="text-[0.78em] text-white/40">{spec.category} · Just now</p>
          </div>
          <span className="num font-medium text-white">{spec.amount}</span>
        </div>
      );
    case 'budget': {
      const r = 14, c = 2 * Math.PI * r;
      const color = spec.pct >= 85 ? '#f7c95e' : '#cdec85';
      return (
        <div className={shell}>
          <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0 -rotate-90">
            <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
            <motion.circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={c}
              initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - spec.pct / 100) }} transition={{ delay: 0.25, duration: 1.2, ease: 'easeOut' }} />
          </svg>
          <div className="min-w-0 flex-1">
            <p className={eyebrow}>{spec.category}</p>
            <p className="num mt-0.5 font-semibold text-white"><Counter to={spec.pct} />% <span className="font-normal text-white/50">of budget</span></p>
          </div>
          <span className="num text-[0.82em] font-medium" style={{ color }}>{spec.left}</span>
        </div>
      );
    }
    case 'goal':
      return (
        <div className={`${shell} flex-col !items-stretch justify-center !gap-2`}>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-medium text-white/90"><PiggyBank className="h-[1em] w-[1em] text-saffron-300" strokeWidth={1.75} />{spec.name}</p>
            <p className="num text-[0.82em] text-white/45"><span className="font-semibold text-saffron-300">{spec.saved}</span> of {spec.target}</p>
          </div>
          <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.08]">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-saffron-300 to-matcha-300"
              initial={{ width: 0 }} animate={{ width: `${spec.pct}%` }} transition={{ delay: 0.25, duration: 1.3, ease: 'easeOut' }} />
          </div>
        </div>
      );
    case 'safe':
      return (
        <div className={shell}>
          <span className={iconBox}><Sun className="h-[1.1em] w-[1.1em] text-saffron-300" strokeWidth={1.75} /></span>
          <div className="min-w-0 flex-1">
            <p className={eyebrow}>Safe to spend today</p>
            <p className="num font-display text-[1.45em] font-semibold leading-tight text-saffron-300"><Counter to={spec.amount} prefix="$" /></p>
          </div>
        </div>
      );
    case 'sub':
      return (
        <div className={shell}>
          <span className={iconBox}><Repeat className="h-[1.1em] w-[1.1em] text-lilac-300" strokeWidth={1.75} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-white/90">{spec.name}</p>
            <p className="text-[0.78em] text-white/40">{spec.when}</p>
          </div>
          <span className="num font-medium text-white">{spec.amount}</span>
        </div>
      );
    case 'income':
      return (
        <div className={shell}>
          <span className={iconBox}><Landmark className="h-[1.1em] w-[1.1em] text-saffron-300" strokeWidth={1.75} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-white/90">{spec.source} received</p>
            <p className="text-[0.78em] text-white/40">Checking ···· 4821</p>
          </div>
          <span className="num font-semibold text-saffron-300">{spec.amount}</span>
        </div>
      );
  }
}

/* ---------------------------------------------------------------- */
/* Garden                                                            */
/* ---------------------------------------------------------------- */

function groovePath(i: number) {
  const y = 215 + i * 98;
  const a = i % 2 === 0 ? 30 : -24;
  return `M-80 ${y + a} C 240 ${y - a * 1.6}, 420 ${y + a * 1.8}, 720 ${y} S 1200 ${y - a * 1.5}, 1520 ${y + a * 0.6}`;
}

const STONES = [
  { x: 1215, y: 655, rx: 70, ry: 40 },
  { x: 205, y: 330, rx: 46, ry: 27 },
  { x: 1300, y: 225, rx: 30, ry: 18 },
];

interface Placed { id: string; x: number; y: number; spec: WidgetSpec }

export default function ZenGarden() {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const guideRefs = useRef<(SVGPathElement | null)[]>([]);
  const grooveRefs = useRef<(SVGGElement | null)[]>([]);
  const rakeRef = useRef<SVGGElement>(null);
  const [cards, setCards] = useState<Placed[]>([]);
  const [narrow, setNarrow] = useState(false);
  const [box, setBox] = useState({ x0: 0, x1: W });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      const scale = Math.max(width / W, height / H);
      const visW = width / scale;
      const x0 = (W - visW) / 2;
      setBox({ x0, x1: x0 + visW });
      setNarrow(width < 900);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const guides = guideRefs.current.filter(Boolean) as SVGPathElement[];
    const grooves = grooveRefs.current.filter(Boolean) as SVGGElement[];
    if (guides.length !== LINES) return;
    const lens = guides.map((p) => p.getTotalLength());
    const cardLines = narrow ? [4, 5] : [0, 1, 2, 3, 4, 5];
    setCards([]);

    const placeFor = (line: number, cycle: number): Placed => {
      const span = box.x1 - box.x0;
      const left = line % 2 === 0;
      const targetX = narrow ? box.x0 + span * (left ? 0.3 : 0.7) : box.x0 + span * (left ? 0.15 : 0.85);
      let best = 0, bestD = Infinity;
      for (let t = 0; t <= 1; t += 0.01) {
        const d = Math.abs(guides[line].getPointAtLength(lens[line] * t).x - targetX);
        if (d < bestD) { bestD = d; best = t; }
      }
      const pt = guides[line].getPointAtLength(lens[line] * best);
      return { id: `${cycle}-${line}`, x: pt.x, y: pt.y, spec: WIDGETS[(cycle * LINES + line) % WIDGETS.length] };
    };

    const setProgress = (i: number, p: number) => {
      grooves[i].querySelectorAll('path').forEach((el) => el.setAttribute('stroke-dashoffset', String(lens[i] * (1 - p))));
    };
    grooves.forEach((g, i) => g.querySelectorAll('path').forEach((el) => el.setAttribute('stroke-dasharray', String(lens[i]))));

    if (reduce) {
      grooves.forEach((_, i) => setProgress(i, 1));
      setCards(cardLines.map((l) => placeFor(l, 0)));
      return;
    }

    let raf = 0, cycle = 0, start = performance.now(), running = true;
    let shown = new Set<number>();
    const perLine = DRAW_MS + PAUSE_MS;
    const total = LINES * perLine + HOLD_MS + FADE_MS;
    const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
    grooves.forEach((_, i) => setProgress(i, 0));

    const frame = (now: number) => {
      if (!running) return;
      let t = now - start;
      if (t > total) {
        cycle += 1; start = now; t = 0; shown = new Set(); setCards([]);
      }
      const fade = t > LINES * perLine + HOLD_MS ? Math.max(0, 1 - (t - LINES * perLine - HOLD_MS) / FADE_MS) : 1;
      for (let i = 0; i < LINES; i++) {
        const p = Math.max(0, Math.min(1, (t - i * perLine) / DRAW_MS));
        grooves[i].setAttribute('opacity', String(fade));
        setProgress(i, ease(p));
        if (p >= 1 && !shown.has(i)) {
          shown.add(i);
          if (cardLines.includes(i)) setCards((cs) => [...cs, placeFor(i, cycle)]);
        }
      }
      const rake = rakeRef.current;
      if (rake) {
        const active = Math.min(LINES - 1, Math.floor(t / perLine));
        const local = (t - active * perLine) / DRAW_MS;
        if (t < LINES * perLine && local >= 0 && local <= 1) {
          const L = lens[active];
          const at = L * ease(local);
          const pt = guides[active].getPointAtLength(at);
          const ahead = guides[active].getPointAtLength(Math.min(L, at + 3));
          const ang = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
          rake.setAttribute('transform', `translate(${pt.x} ${pt.y + ((TINES - 1) * TINE_GAP) / 2}) rotate(${ang})`);
          rake.setAttribute('opacity', String(Math.min(1, local * 10, (1 - local) * 10)));
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
  }, [reduce, narrow, box]);

  const half = ((TINES - 1) * TINE_GAP) / 2;

  return (
    <div ref={wrapRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <radialGradient id="zgSand" cx="50%" cy="36%" r="85%">
            <stop offset="0%" stopColor="#17372e" />
            <stop offset="100%" stopColor="#0a1915" />
          </radialGradient>
          <radialGradient id="zgStone" cx="38%" cy="28%" r="85%">
            <stop offset="0%" stopColor="#3a554c" />
            <stop offset="70%" stopColor="#1a2f29" />
            <stop offset="100%" stopColor="#10211c" />
          </radialGradient>
          <filter id="zgBlur"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>

        <rect width={W} height={H} fill="url(#zgSand)" />

        {/* Settled texture */}
        {Array.from({ length: 26 }).map((_, k) => (
          <path key={k} d={`M-80 ${24 + k * 33} C 400 ${8 + k * 33}, 900 ${52 + k * 33}, 1520 ${18 + k * 33}`}
            fill="none" stroke="#e7f5c4" strokeOpacity="0.025" strokeWidth="1" />
        ))}

        {/* Fresh grooves: fine shadow + highlight per tine */}
        {Array.from({ length: LINES }).map((_, i) => (
          <g key={i} ref={(el) => { grooveRefs.current[i] = el; }}>
            {Array.from({ length: TINES }).map((__, k) => (
              <g key={k} transform={`translate(0 ${k * TINE_GAP})`}>
                <path d={groovePath(i)} fill="none" stroke="#050f0c" strokeOpacity="0.55" strokeWidth="1.8" strokeLinecap="round" />
                <path d={groovePath(i)} transform="translate(0 1.4)" fill="none" stroke="#e7f5c4" strokeOpacity={k === 0 || k === TINES - 1 ? 0.12 : 0.2}
                  strokeWidth="0.9" strokeLinecap="round" />
              </g>
            ))}
          </g>
        ))}
        {Array.from({ length: LINES }).map((_, i) => (
          <path key={`guide${i}`} ref={(el) => { guideRefs.current[i] = el; }} d={groovePath(i)} fill="none" stroke="none" />
        ))}

        {/* Stones with raked rings */}
        {STONES.map((s, i) => (
          <g key={i}>
            <ellipse cx={s.x} cy={s.y} rx={s.rx + 66} ry={s.ry + 46} fill="#12291f" opacity="0.9" />
            {[1, 2, 3, 4].map((k) => (
              <g key={k}>
                <ellipse cx={s.x} cy={s.y} rx={s.rx + k * 14} ry={s.ry + k * 10} fill="none" stroke="#050f0c" strokeOpacity="0.5" strokeWidth="1.8" />
                <ellipse cx={s.x} cy={s.y + 1.4} rx={s.rx + k * 14} ry={s.ry + k * 10} fill="none" stroke="#e7f5c4" strokeOpacity={0.14 - k * 0.022} strokeWidth="0.9" />
              </g>
            ))}
            <ellipse cx={s.x + 8} cy={s.y + s.ry * 0.7} rx={s.rx * 0.95} ry={s.ry * 0.4} fill="#000" opacity="0.4" filter="url(#zgBlur)" />
            <ellipse cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill="url(#zgStone)" />
            <ellipse cx={s.x - s.rx * 0.28} cy={s.y - s.ry * 0.4} rx={s.rx * 0.34} ry={s.ry * 0.16} fill="#ffffff" opacity="0.06" />
          </g>
        ))}

        {/* Minimal rake, drawn in fine lines */}
        <g ref={rakeRef} opacity="0">
          <line x1="-3" y1="0" x2="-150" y2="-128" stroke="#e7f5c4" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="-3" y1={-half - 6} x2="-3" y2={half + 6} stroke="#e7f5c4" strokeOpacity="0.85" strokeWidth="2.4" strokeLinecap="round" />
          {Array.from({ length: TINES }).map((_, k) => (
            <line key={k} x1="-2" y1={-half + k * TINE_GAP} x2="5" y2={-half + k * TINE_GAP} stroke="#e7f5c4" strokeOpacity="0.85" strokeWidth="1.2" strokeLinecap="round" />
          ))}
          <ellipse cx="6" cy="0" rx="18" ry={half + 14} fill="#e7f5c4" opacity="0.06" filter="url(#zgBlur)" />
        </g>

        {/* Live preview widgets */}
        <AnimatePresence>
          {cards.map((c) => {
            const w = narrow ? 360 : 300;
            const h = c.spec.kind === 'goal' ? 66 : 62;
            const x = Math.min(Math.max(c.x - w / 2, box.x0 + 16), box.x1 - w - 16);
            return (
              <foreignObject key={c.id} x={x} y={narrow ? c.y + 32 : c.y - h - 18} width={w} height={h + 12} overflow="visible">
                <motion.div
                  initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)', transition: { duration: 0.5 } }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  style={{ height: h, fontSize: narrow ? 16 : 14 }}
                >
                  <Widget spec={c.spec} />
                </motion.div>
              </foreignObject>
            );
          })}
        </AnimatePresence>
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_44%_38%_at_50%_42%,rgba(10,25,21,0.9),transparent)]" />
      <div className="grain absolute inset-0" />
    </div>
  );
}
