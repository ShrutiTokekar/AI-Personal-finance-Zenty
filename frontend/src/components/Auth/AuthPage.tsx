import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Leaf, ShieldCheck } from 'lucide-react';
import { LogoMark } from '../ui';
import type { PublicConfig, User } from '../../services/api';
import AuthCard, { type AuthMode } from './AuthCard';

interface Props {
  config: PublicConfig | null;
  mode: AuthMode;
  resetToken?: string | null;
  banner?: { kind: 'ok' | 'error'; text: string } | null;
  onAuthed: (user: User) => void;
  onBack: () => void;
}

const QUOTES = [
  { q: 'Safe-to-spend changed how I shop. I just check one number and relax.', a: 'A calmer Tuesday' },
  { q: 'Privacy mode is genius. I can open my finances on the train without worrying.', a: 'Commuter mode' },
  { q: 'It found two subscriptions I forgot I was paying for. Paid for itself on day one.', a: 'Subscription radar' },
];

function SidePanel() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((n) => (n + 1) % QUOTES.length), 5000);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <div className="relative hidden overflow-hidden bg-ink lg:flex lg:flex-col lg:justify-between lg:p-14">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="aurora-blob absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full bg-primary-500/35 blur-[110px]" />
        <div className="aurora-blob absolute -bottom-40 -left-20 h-[420px] w-[420px] rounded-full bg-matcha-400/20 blur-[110px]" style={{ animationDelay: '-8s' }} />
        {[0, 2, 4, 6].map((d) => (
          <span key={d} className="ripple-ring h-[620px] w-[620px]" style={{ animationDelay: `${d}s`, top: '55%' }} />
        ))}
        <div className="grain absolute inset-0" />
      </div>

      <div className="relative flex items-center gap-2 text-sm text-white/60">
        <ShieldCheck className="h-4 w-4 text-matcha-300" /> Bank-grade encryption · Your data is never sold
      </div>

      <div className="relative">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}
          className="mx-auto mb-14 flex h-40 w-40 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] backdrop-blur">
          <Leaf className="h-14 w-14 text-matcha-300" />
        </motion.div>
        <div className="min-h-[150px]">
          <AnimatePresence mode="wait">
            <motion.figure key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.5 }}>
              <blockquote className="font-display text-3xl leading-snug text-white">“{QUOTES[i].q}”</blockquote>
              <figcaption className="mt-4 text-sm font-medium text-matcha-300">{QUOTES[i].a}</figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>
        <div className="mt-6 flex gap-1.5">
          {QUOTES.map((_, n) => (
            <button key={n} onClick={() => setI(n)} aria-label={`Show quote ${n + 1}`}
              className={`h-1.5 rounded-full transition-all ${n === i ? 'w-8 bg-matcha-300' : 'w-3 bg-white/20'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage({ config, mode, resetToken, banner, onAuthed, onBack }: Props) {
  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Home
          </button>
          <div className="flex items-center gap-2">
            <LogoMark className="h-8 w-8" />
            <span className="font-display text-xl font-semibold text-ink">Zenty</span>
          </div>
        </div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          {banner && (
            <p role="status" className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${banner.kind === 'ok'
              ? 'border-primary-200 bg-primary-50 text-primary-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {banner.text}
            </p>
          )}
          <AuthCard key={mode} config={config} initialMode={mode} resetToken={resetToken} onAuthed={onAuthed} />
        </motion.div>
        <p className="text-center text-xs text-gray-400">Zenty will never ask for your bank password by email.</p>
      </div>
      <SidePanel />
    </div>
  );
}
