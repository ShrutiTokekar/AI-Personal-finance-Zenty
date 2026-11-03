import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarDays,
  Coffee,
  Eye,
  EyeOff,
  KeyRound,
  Leaf,
  Lock,
  Menu,
  Repeat,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { LogoMark } from '../ui';
import ZenGarden from './ZenGarden';

interface Props {
  onSignIn: () => void;
  onSignUp: () => void;
}

const WORDS = ['stress.', 'guesswork.', 'spreadsheets.', '3 a.m. worry.'];

/* ---------------------------------------------------------------- */
/* Hero visuals                                                      */
/* ---------------------------------------------------------------- */

function RotatingWord() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((n) => (n + 1) % WORDS.length), 2400);
    return () => clearInterval(t);
  }, [reduce]);
  return (
    <span className="relative inline-flex h-[1.15em] overflow-hidden align-bottom">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={WORDS[i]}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="bg-gradient-to-r from-saffron-300 via-saffron-200 to-matcha-300 bg-clip-text text-transparent italic"
        >
          {WORDS[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function CountUp({ to, duration = 1.6 }: { to: number; duration?: number }) {
  const [n, setN] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) {
      setN(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / (duration * 1000));
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, reduce]);
  return <>{n}</>;
}

function Chip({ children, className, delay }: { children: ReactNode; className: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 220, damping: 18 }}
      className={`absolute ${className}`}
    >
      <div className="floaty flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm text-white shadow-lift backdrop-blur-md"
        style={{ animationDelay: `${delay}s` }}>
        {children}
      </div>
    </motion.div>
  );
}

function HeroMockup() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 120, damping: 14 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-14, 14]), { stiffness: 120, damping: 14 });

  const onMove = (e: ReactMouseEvent) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  const bars = [38, 62, 45, 80, 56, 70];
  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className="relative mx-auto w-full max-w-[520px] [perspective:1200px]">
      {/* Pond ripples behind the card */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {[0, 1.5, 3, 4.5, 6].map((d) => (
          <span key={d} className="ripple-ring h-[560px] w-[560px]" style={{ animationDelay: `${d}s` }} />
        ))}
      </div>

      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
        initial={{ opacity: 0, y: 40, rotateX: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-[28px] border border-white/15 bg-gradient-to-b from-white/[0.14] to-white/[0.04] p-5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between text-white/70 text-xs">
          <span className="flex items-center gap-1.5"><Leaf className="h-3.5 w-3.5 text-matcha-300" /> Zen Score</span>
          <span className="rounded-full bg-matcha-300/15 px-2 py-0.5 font-semibold text-matcha-300">Thriving</span>
        </div>
        <div className="mt-4 flex items-center gap-5" style={{ transform: 'translateZ(40px)' }}>
          <div className="relative h-28 w-28 shrink-0">
            <svg viewBox="0 0 110 110" className="h-28 w-28 -rotate-90" aria-hidden="true">
              <circle cx="55" cy="55" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="9" />
              <motion.circle cx="55" cy="55" r={R} fill="none" stroke="url(#heroGrad)" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - 0.82) }}
                transition={{ duration: 1.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }} />
              <defs>
                <linearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f7c95e" />
                  <stop offset="100%" stopColor="#4c9f81" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-display text-4xl font-semibold text-white">
              <CountUp to={82} />
            </span>
          </div>
          <div className="flex-1 space-y-2.5">
            {[['Savings rate', 92], ['Budgets on track', 75], ['Spending pace', 84]].map(([l, v], i) => (
              <div key={l as string}>
                <div className="flex justify-between text-[11px] text-white/60"><span>{l}</span><span>{v}%</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-saffron-300 to-primary-300"
                    initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ delay: 0.6 + i * 0.15, duration: 1 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 rounded-2xl bg-black/20 p-4" style={{ transform: 'translateZ(24px)' }}>
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>Monthly spending</span><span>Last 6 months</span>
          </div>
          <div className="mt-3 flex h-20 items-end gap-2.5">
            {bars.map((h, i) => (
              <motion.div key={i} className={`flex-1 rounded-t-md ${i === bars.length - 1 ? 'bg-saffron-300' : 'bg-primary-400/70'}`}
                initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.8 + i * 0.08, type: 'spring', stiffness: 120, damping: 16 }} />
            ))}
          </div>
        </div>
      </motion.div>

      <Chip className="-left-4 top-8 sm:-left-12" delay={1.4}>
        <Coffee className="h-4 w-4 text-matcha-300" /> <span>Coffee <span className="text-white/60">−$4.50</span></span>
      </Chip>
      <Chip className="-right-2 top-1/2 sm:-right-10" delay={1.8}>
        <Sun className="h-4 w-4 text-saffron-300" /> <span>Safe to spend <strong>$48</strong></span>
      </Chip>
      <Chip className="left-6 -bottom-6" delay={2.2}>
        <Repeat className="h-4 w-4 text-matcha-300" /> <span>Netflix renews in 3 days</span>
      </Chip>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Scroll helpers                                                    */
/* ---------------------------------------------------------------- */

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function ScrollWord({ word, range, progress }: { word: string; range: [number, number]; progress: MotionValue<number> }) {
  const opacity = useTransform(progress, range, [0.15, 1]);
  return <motion.span style={{ opacity }} className="mr-[0.25em] inline-block">{word}</motion.span>;
}

function ScrollRevealText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.4'] });
  const words = text.split(' ');
  return (
    <p ref={ref} className="font-display text-3xl leading-[1.25] font-medium tracking-tight text-ink sm:text-5xl">
      {words.map((w, i) => (
        <ScrollWord key={i} word={w} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} />
      ))}
    </p>
  );
}

/* ---------------------------------------------------------------- */
/* Feature micro-demos                                               */
/* ---------------------------------------------------------------- */

function TypingDemo() {
  const phrases = ['spent 12 on lunch', 'got paid 2000 salary', 'save 50 to vacation'];
  const reduce = useReducedMotion();
  const [text, setText] = useState(reduce ? phrases[0] : '');
  useEffect(() => {
    if (reduce) return;
    let p = 0, c = 0, deleting = false;
    const t = setInterval(() => {
      const full = phrases[p];
      if (!deleting) {
        c++;
        if (c > full.length + 12) deleting = true;
      } else {
        c -= 2;
        if (c <= 0) { deleting = false; p = (p + 1) % phrases.length; c = 0; }
      }
      setText(full.slice(0, Math.max(0, Math.min(c, full.length))));
    }, 70);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink shadow-card">
      <Sparkles className="h-4 w-4 shrink-0 text-matcha-600" />
      <span className="truncate">{text}</span><span className="caret -ml-1 text-primary-500">|</span>
    </div>
  );
}

function PrivacyDemo() {
  const [hidden, setHidden] = useState(true);
  return (
    <button onClick={() => setHidden((h) => !h)} className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-4 py-3 shadow-card">
      <span className="text-sm text-gray-500">Balance</span>
      <span className={`font-display text-xl font-semibold text-ink transition ${hidden ? 'blur-[7px]' : ''}`}>$12,480.22</span>
      {hidden ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
    </button>
  );
}

function HeatDemo() {
  const cells = [0, 1, 0, 2, 3, 0, 1, 0, 0, 2, 1, 4, 0, 1, 2, 0, 0, 3, 1, 0, 2, 1, 0, 0, 2, 4, 1, 0];
  const heat = ['bg-gray-100', 'bg-primary-100', 'bg-primary-200', 'bg-primary-400', 'bg-primary-600'];
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {cells.map((v, i) => (
        <motion.span key={i} className={`aspect-square rounded-md ${heat[v]}`}
          initial={{ opacity: 0, scale: 0.4 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
          transition={{ delay: i * 0.02 }} />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Page                                                              */
/* ---------------------------------------------------------------- */

export default function LandingPage({ onSignIn, onSignUp }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [['About', '#about'], ['Features', '#features'], ['Security', '#security']];

  return (
    <div className="bg-paper text-gray-800">
      {/* Nav */}
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-ink/80 backdrop-blur-xl shadow-lift' : ''}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-8">
          <a href="#top" className="flex items-center gap-2.5 text-white">
            <LogoMark className="h-9 w-9" />
            <span className="font-display text-2xl font-semibold tracking-tight">Zenty</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-white/70 md:flex">
            {links.map(([l, h]) => <a key={h} href={h} className="transition hover:text-white">{l}</a>)}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <button onClick={onSignIn} className="rounded-xl px-4 py-2 text-sm font-semibold text-white/80 hover:text-white">Sign in</button>
            <button onClick={onSignUp} className="rounded-xl bg-matcha-300 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-matcha-200">Get started</button>
          </div>
          <button onClick={() => setMenu((m) => !m)} className="p-2 text-white md:hidden" aria-label="Toggle menu">
            {menu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        <AnimatePresence>
          {menu && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden bg-ink/95 backdrop-blur-xl md:hidden">
              <div className="space-y-1 px-4 pb-6">
                {links.map(([l, h]) => (
                  <a key={h} href={h} onClick={() => setMenu(false)} className="block rounded-xl px-3 py-3 text-white/80 hover:bg-white/5">{l}</a>
                ))}
                <div className="grid grid-cols-2 gap-2 pt-3">
                  <button onClick={onSignIn} className="rounded-xl border border-white/15 py-3 font-semibold text-white">Sign in</button>
                  <button onClick={onSignUp} className="rounded-xl bg-matcha-300 py-3 font-semibold text-ink">Get started</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero: zen garden being raked, with financial steps appearing in the grooves */}
      <section id="top" className="relative flex min-h-[1080px] items-start overflow-hidden bg-ink pt-32 pb-24 sm:min-h-[100svh] sm:items-center sm:pt-28">
        <ZenGarden />
        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-ink/60 px-3 py-1.5 text-sm text-white/80 backdrop-blur">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-saffron-300 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-saffron-300" /></span>
            Your calm money companion
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }}
            className="mt-6 font-display text-5xl font-semibold leading-[1.02] tracking-tight text-white sm:text-7xl">
            Money, minus<br />the <RotatingWord />
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }}
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/70">
            Zenty brings your spending, budgets, goals, investments and bank accounts into one quiet, private place,
            and tells you each morning exactly what's safe to spend.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }}
            className="mt-9 flex flex-wrap justify-center gap-3">
            <button onClick={onSignUp}
              className="group inline-flex items-center gap-2 rounded-2xl bg-matcha-300 px-6 py-3.5 font-semibold text-ink shadow-[0_10px_40px_-10px_rgba(205,236,133,0.6)] transition hover:bg-matcha-200">
              Start free <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </button>
            <a href="#about" className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-ink/40 px-6 py-3.5 font-semibold text-white/90 backdrop-blur transition hover:bg-white/5">
              Learn more
            </a>
          </motion.div>
          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/55">
            <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-matcha-300" /> Bank-grade encryption</li>
            <li className="flex items-center gap-1.5"><Lock className="h-4 w-4 text-matcha-300" /> Your data is never sold</li>
            <li className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-saffron-300" /> Free to start</li>
          </motion.ul>
        </div>
      </section>

      {/* Marquee */}
      <div className="overflow-hidden border-y border-line bg-white py-5" aria-hidden="true">
        <div className="marquee-track flex w-max gap-12 whitespace-nowrap font-display text-2xl text-gray-300">
          {[0, 1].map((k) => (
            <div key={k} className="flex gap-12">
              {['Zen Score', 'Safe to spend', 'Budgets', 'Savings goals', 'Stock alerts', 'Bank sync', 'Subscriptions', 'Privacy mode'].map((w) => (
                <span key={w} className="flex items-center gap-12">{w}<Leaf className="h-5 w-5 text-primary-300" /></span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* About */}
      <section id="about" className="mx-auto max-w-5xl px-4 py-28 sm:px-8 sm:py-36">
        <Reveal><p className="eyebrow text-primary-600">About Zenty</p></Reveal>
        <div className="mt-6">
          <ScrollRevealText text="Most money apps make you feel watched, judged or overwhelmed. Zenty was built on a simpler idea: your finances should feel calm. One glance tells you how you're doing, what's safe to spend today, and what to do next. Nothing more, nothing noisy." />
        </div>
        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            { icon: Leaf, t: 'Calm by design', d: 'No red alarms or guilt trips. Gentle nudges and a single score that shows the bigger picture.' },
            { icon: ShieldCheck, t: 'Private by default', d: 'Your data is yours. We never sell it, never show ads, and you can export or delete it any time.' },
            { icon: Sparkles, tone: 'lilac', t: 'Smart, not noisy', d: 'Zenty spots subscriptions, unusual spending and stock moves, and only tells you when it matters.' },
          ].map((p, i) => (
            <Reveal key={p.t} delay={i * 0.1}>
              <div className="h-full rounded-3xl border border-line bg-white p-7 shadow-card">
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${'tone' in p ? 'bg-lilac-50' : 'bg-primary-50'}`}><p.icon className={`h-5 w-5 ${'tone' in p ? 'text-lilac-600' : 'text-primary-600'}`} /></span>
                <h3 className="mt-5 text-lg font-semibold text-ink">{p.t}</h3>
                <p className="mt-2 text-gray-600 leading-relaxed">{p.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Showcase */}
      <section className="relative overflow-hidden bg-ink py-28 text-white">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="aurora-blob absolute -left-32 top-10 h-[460px] w-[460px] rounded-full bg-primary-500/30 blur-[120px]" />
          <div className="aurora-blob absolute right-0 bottom-0 h-[420px] w-[420px] rounded-full bg-lilac-500/20 blur-[120px]" style={{ animationDelay: '-7s' }} />
          <div className="grain absolute inset-0" />
        </div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-8 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow text-matcha-300">One glance</p>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">Your whole money life, in one calm screen.</h2>
            <p className="mt-5 max-w-lg text-lg text-white/60">Move your mouse over the preview. Your Zen Score, budgets and spending update live as you add transactions or sync your bank.</p>
            <ul className="mt-8 space-y-3 text-white/75">
              {['A daily safe-to-spend number', 'Budgets that warn you before, not after', 'Subscriptions found automatically'].map((t) => (
                <li key={t} className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-saffron-300/15"><Sparkles className="h-3.5 w-3.5 text-saffron-300" /></span>{t}</li>
              ))}
            </ul>
          </Reveal>
          <HeroMockup />
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <Reveal className="max-w-2xl">
            <p className="eyebrow text-primary-600">How it works</p>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Set up in three calm minutes.</h2>
          </Reveal>
          <div className="relative mt-16 grid gap-10 md:grid-cols-3">
            <div className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-line to-transparent md:block" />
            {[
              ['Create your account', 'Sign up with Google or email. It takes 30 seconds and costs nothing.'],
              ['Add or link your money', 'Type "spent 12 on lunch", or securely connect your bank so transactions flow in.'],
              ['Breathe', 'Check your Zen Score and safe-to-spend each day. Zenty handles the math and the reminders.'],
            ].map(([t, d], i) => (
              <Reveal key={t} delay={i * 0.12}>
                <div className="relative">
                  <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink font-display text-2xl font-semibold text-matcha-300 shadow-lift">{i + 1}</span>
                  <h3 className="mt-6 text-xl font-semibold text-ink">{t}</h3>
                  <p className="mt-2 text-gray-600 leading-relaxed">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features bento */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-28 sm:px-8">
        <Reveal className="max-w-2xl">
          <p className="eyebrow text-primary-600">Features</p>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Everything you need. Nothing you don't.</h2>
        </Reveal>
        <div className="mt-14 grid auto-rows-[minmax(220px,auto)] gap-5 md:grid-cols-6">
          <Reveal className="md:col-span-4">
            <div className="group relative h-full overflow-hidden rounded-3xl bg-ink p-8 text-white">
              <div className="aurora-blob absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary-500/30 blur-3xl" />
              <div className="relative flex h-full flex-col justify-between gap-8 sm:flex-row sm:items-end">
                <div className="max-w-sm">
                  <Leaf className="h-6 w-6 text-matcha-300" />
                  <h3 className="mt-4 font-display text-3xl font-semibold">Zen Score</h3>
                  <p className="mt-2 text-white/60">One number from 0 to 100 that sums up your financial health: savings, budgets, spending pace and goals, with a tip for each.</p>
                </div>
                <div className="font-display text-8xl font-semibold leading-none text-saffron-300 transition group-hover:scale-105">82</div>
              </div>
            </div>
          </Reveal>
          <Reveal className="md:col-span-2" delay={0.05}>
            <div className="flex h-full flex-col justify-between rounded-3xl border border-line bg-white p-7 shadow-card transition hover:-translate-y-1 hover:shadow-lift">
              <Sun className="h-6 w-6 text-primary-600" />
              <div>
                <p className="font-display text-5xl font-semibold text-saffron-600">$48</p>
                <h3 className="mt-2 font-semibold text-ink">Safe to spend today</h3>
                <p className="mt-1 text-sm text-gray-500">Your budgets, divided by the days left. Recalculated every time you spend.</p>
              </div>
            </div>
          </Reveal>
          <Reveal className="md:col-span-2" delay={0.05}>
            <div className="flex h-full flex-col justify-between gap-6 rounded-3xl border border-line bg-white p-7 shadow-card transition hover:-translate-y-1 hover:shadow-lift">
              <div>
                <h3 className="font-semibold text-ink">Quick add, in plain English</h3>
                <p className="mt-1 text-sm text-gray-500">Type it like a text message. Press ⌘K from anywhere.</p>
              </div>
              <TypingDemo />
            </div>
          </Reveal>
          <Reveal className="md:col-span-2" delay={0.1}>
            <div className="flex h-full flex-col justify-between gap-6 rounded-3xl border border-line bg-white p-7 shadow-card transition hover:-translate-y-1 hover:shadow-lift">
              <div>
                <h3 className="font-semibold text-ink">Privacy mode</h3>
                <p className="mt-1 text-sm text-gray-500">On the train? One tap blurs every number. Tap the balance to try it.</p>
              </div>
              <PrivacyDemo />
            </div>
          </Reveal>
          <Reveal className="md:col-span-2" delay={0.15}>
            <div className="flex h-full flex-col justify-between gap-6 rounded-3xl border border-line bg-white p-7 shadow-card transition hover:-translate-y-1 hover:shadow-lift">
              <div>
                <h3 className="flex items-center gap-2 font-semibold text-ink"><CalendarDays className="h-4 w-4 text-primary-600" /> Spending calendar</h3>
                <p className="mt-1 text-sm text-gray-500">See your heavy days at a glance.</p>
              </div>
              <HeatDemo />
            </div>
          </Reveal>
          <Reveal className="md:col-span-3" delay={0.05}>
            <div className="flex h-full items-start gap-5 rounded-3xl border border-line bg-white p-7 shadow-card transition hover:-translate-y-1 hover:shadow-lift">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-lilac-50"><Repeat className="h-6 w-6 text-lilac-600" /></span>
              <div>
                <h3 className="font-semibold text-ink">Subscription radar</h3>
                <p className="mt-1 text-gray-500">Zenty finds repeating charges on its own and tells you what renews next, so nothing sneaks up on you.</p>
              </div>
            </div>
          </Reveal>
          <Reveal className="md:col-span-3" delay={0.1}>
            <div className="flex h-full items-start gap-5 rounded-3xl border border-line bg-white p-7 shadow-card transition hover:-translate-y-1 hover:shadow-lift">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-lilac-50"><BellRing className="h-6 w-6 text-lilac-600" /></span>
              <div>
                <h3 className="font-semibold text-ink">Stock movement emails</h3>
                <p className="mt-1 text-gray-500">A daily note after market close when your holdings move more than you care about. You choose the threshold.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="relative overflow-hidden bg-ink py-28 text-white">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="aurora-blob absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-500/20 blur-[140px]" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-14 px-4 sm:px-8 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <p className="eyebrow text-matcha-300">Security</p>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">Built like a vault. Feels like a garden.</h2>
            <p className="mt-5 max-w-lg text-lg text-white/60">You're trusting us with your finances. We take that seriously, with the same protections banks rely on.</p>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Building2, t: 'Bank logins never touch Zenty', d: 'You sign in to your bank inside Plaid\'s secure window. We never see or store your password.' },
              { icon: KeyRound, t: 'Encrypted at rest', d: 'Bank access keys are encrypted on our servers and never sent to your browser.' },
              { icon: Lock, t: 'Hardened sign-in', d: 'Argon2id password hashing, brute-force lockouts and secure, httpOnly sessions.' },
              { icon: ShieldCheck, t: 'Only you see your data', d: 'Every record is locked to your account. Export it or delete it whenever you like.' },
            ].map((x, i) => (
              <Reveal key={x.t} delay={i * 0.08}>
                <div className="h-full rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur transition hover:bg-white/[0.07]">
                  <x.icon className="h-6 w-6 text-matcha-300" />
                  <h3 className="mt-4 font-semibold text-white">{x.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/55">{x.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 py-28 text-center sm:px-8">
        <Reveal>
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">Ready to feel calm about money?</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-gray-600">Join Zenty in 30 seconds. Free to start, private forever.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <button onClick={onSignUp} className="group inline-flex items-center gap-2 rounded-2xl bg-ink px-7 py-4 font-semibold text-white shadow-lift transition hover:bg-ink-700">
              Create your free account <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </button>
            <button onClick={onSignIn} className="rounded-2xl border border-line bg-white px-7 py-4 font-semibold text-ink transition hover:bg-gray-50">
              I already have an account
            </button>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-gray-500 sm:px-8">
          <div className="flex items-center gap-2">
            <LogoMark className="h-7 w-7" />
            <span className="font-display text-lg font-semibold text-ink">Zenty</span>
          </div>
          <p>© {new Date().getFullYear()} Zenty. Zenty is not a bank and does not give financial advice.</p>
        </div>
      </footer>
    </div>
  );
}
