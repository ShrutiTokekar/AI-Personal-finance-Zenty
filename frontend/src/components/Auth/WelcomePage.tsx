import { motion } from 'framer-motion';
import { BarChart3, Bell, Building2, KeyRound, Lock, PiggyBank, ShieldCheck, Sparkles, Target, TrendingUp } from 'lucide-react';
import { type PublicConfig, type User } from '../../services/api';
import AuthCard, { type AuthMode } from './AuthCard';

interface Props {
  config: PublicConfig | null;
  initialMode?: AuthMode;
  resetToken?: string | null;
  banner?: { kind: 'ok' | 'error'; text: string } | null;
  onAuthed: (user: User) => void;
}

const features = [
  { icon: BarChart3, title: 'See where it goes', text: 'Automatic charts of your spending by category and month.' },
  { icon: Target, title: 'Budgets that nudge', text: "Set monthly limits and see what's left at a glance." },
  { icon: PiggyBank, title: 'Savings goals', text: 'Track progress toward the trip, the car, the safety net.' },
  { icon: TrendingUp, title: 'Stock alerts', text: 'A daily email when your holdings move up or down.' },
  { icon: Building2, title: 'Bank sync', text: 'Link accounts securely through Plaid; transactions import themselves.' },
  { icon: Sparkles, title: 'Quick assistant', text: 'Type "spent $12 on lunch" and Zenty files it for you.' },
];

const security = [
  { icon: Lock, text: 'Bank logins go straight to Plaid. Zenty never sees them.' },
  { icon: KeyRound, text: 'Bank access tokens are encrypted and never leave our server.' },
  { icon: ShieldCheck, text: 'Passwords hashed with Argon2id; brute-force lockouts built in.' },
  { icon: Bell, text: 'Your data is visible only to you. No sharing, no selling.' },
];

export default function WelcomePage({ config, initialMode, resetToken, banner, onAuthed }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 text-stone-900">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-orange-300/30 blur-3xl" />
        <div className="absolute top-1/2 -left-40 h-96 w-96 rounded-full bg-amber-300/30 blur-3xl" />
      </div>

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-6">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-9 w-9 object-contain" />
          <span className="text-2xl font-extrabold font-serif text-yellow-950">Zenty</span>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-green-800 border border-green-200">
          <ShieldCheck className="h-3.5 w-3.5" /> Bank-grade encryption
        </span>
      </header>

      <main className="relative mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 pb-16 pt-4 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:pt-12">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="inline-flex items-center gap-2 rounded-full bg-orange-200/60 px-3 py-1 text-sm font-semibold text-orange-900">
            <Sparkles className="h-4 w-4" /> Your calm money companion
          </p>
          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight text-amber-950">
            Money, minus <span className="bg-gradient-to-r from-orange-500 to-amber-600 bg-clip-text text-transparent">the stress.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-stone-700">
            Zenty brings your spending, budgets, savings goals, investments and bank accounts into one
            private, beautifully simple place.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {features.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="rounded-2xl bg-white/70 border border-orange-100 p-4 backdrop-blur">
                <f.icon className="h-6 w-6 text-orange-600" />
                <h3 className="mt-2 font-bold text-amber-950">{f.title}</h3>
                <p className="mt-1 text-sm text-stone-600">{f.text}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col items-center lg:sticky lg:top-8">
          {banner && (
            <p role="status" className={`mb-4 w-full max-w-md rounded-2xl px-4 py-3 text-sm border ${banner.kind === 'ok'
              ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {banner.text}
            </p>
          )}
          <AuthCard config={config} initialMode={initialMode} resetToken={resetToken} onAuthed={onAuthed} />
        </motion.section>
      </main>

      <section className="relative border-t border-orange-200/60 bg-white/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
          <h2 className="text-2xl font-extrabold text-amber-950">Built to protect your finances</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {security.map((s) => (
              <div key={s.text} className="flex gap-3 rounded-2xl bg-white border border-orange-100 p-4">
                <s.icon className="h-5 w-5 shrink-0 text-green-700 mt-0.5" />
                <p className="text-sm text-stone-700">{s.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-xs text-stone-500">© {new Date().getFullYear()} Zenty. Zenty is not a bank and does not give financial advice.</p>
        </div>
      </section>
    </div>
  );
}
