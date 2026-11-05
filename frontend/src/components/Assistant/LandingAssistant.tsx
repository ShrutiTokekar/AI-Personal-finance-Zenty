import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Sparkles, X } from 'lucide-react';

/**
 * Visitor assistant for the landing page. Answers only three kinds of
 * question: Zenty's features, how to sign up / sign in, and about Zenty.
 * Runs entirely in the browser; it has no access to accounts or data.
 */

type Cta = 'signup' | 'signin';
type Msg = { id: number; from: 'you' | 'zenty'; text: string; ctas?: Cta[] };

const ANSWERS: { test: RegExp; text: string; ctas?: Cta[] }[] = [
  {
    test: /sign ?up|create (an )?account|register|join|get started|start free|how (do i|to) (start|begin)/,
    text: 'Signing up takes about 30 seconds:\n1. Tap "Get started".\n2. Enter your name and email, choose a password and confirm it (a mobile number is optional).\n3. Open the welcome email and tap "Verify my email".\n4. For extra security, turn on two-step sign-in with a free authenticator app in Settings.\nYou can also continue with Google.',
    ctas: ['signup'],
  },
  {
    test: /sign ?in|log ?in|login|log on|forgot|password|reset/,
    text: 'Tap "Sign in", then enter your email and password. If two-step sign-in is on, enter the 6-digit code from your authenticator app (or get one by email). Forgot your password? Choose "Forgot password?" on the sign-in screen and we\'ll email you a reset link.',
    ctas: ['signin'],
  },
  {
    test: /about|who (are|is|made)|company|mission|team|story|why zenty|what is zenty/,
    text: 'Zenty was built on a simple idea: your finances should feel calm. Most money apps make you feel watched, judged or overwhelmed. Zenty gives you one glance at how you\'re doing, what\'s safe to spend today, and what to do next. We never sell your data or show ads.',
  },
  {
    test: /secur|safe|privacy|private|encrypt|hack|data|bank login|plaid/,
    text: 'Security is built in: bank logins happen inside Plaid\'s secure window (Zenty never sees them), bank access keys are encrypted on our servers, passwords are protected with Argon2id, sign-in can require a code from a free authenticator app, and only you can see your data. You can export or delete everything any time.',
  },
  {
    test: /price|cost|free|pay|subscription plan|premium/,
    text: 'Zenty is free to start. Create an account and everything on this page is available to you.',
    ctas: ['signup'],
  },
  {
    test: /zen score|score/,
    text: 'Your Zen Score is one number from 0 to 100 that sums up your financial health: savings rate, budgets on track, spending pace and goal progress, with a tip for each.',
  },
  {
    test: /safe to spend|daily/,
    text: '"Safe to spend today" takes what\'s left in your budgets and divides it by the days left in the month, recalculated every time you spend.',
  },
  {
    test: /bank|link|connect|account/,
    text: 'After you sign up and verify your email, you can securely link checking, savings and credit card accounts. Transactions import automatically and are labelled by account.',
  },
  {
    test: /stock|invest|alert|portfolio/,
    text: 'Add your stocks and Zenty shows live prices and gains, and can email you after market close when your holdings move more than you choose.',
  },
  {
    test: /budget|goal|saving|subscription|calendar|privacy mode|quick add|feature|what can|do you do|offer/,
    text: 'Here\'s what Zenty offers:\n• Zen Score, your financial health in one number\n• Safe to spend today\n• Budgets that warn you early\n• Savings goals with game plans\n• Secure bank sync with checking, savings and credit labels\n• Live stock prices and movement emails\n• Subscription radar and a spending calendar\n• Quick add in plain English, plus privacy mode\n• An assistant that can add or delete transactions and plan your budget',
    ctas: ['signup'],
  },
];

const FALLBACK = "I can help with Zenty's features, how to sign up or sign in, and who we are. Try one of the suggestions below.";
const SUGGESTIONS = ['What can Zenty do?', 'How do I sign up?', 'Is my data safe?', 'About Zenty'];

let nextId = 1;

function answer(q: string): Omit<Msg, 'id' | 'from'> {
  const low = q.toLowerCase();
  if (/^(hi|hello|hey|yo|hiya)\b/.test(low)) return { text: "Hi! I'm Zenty's guide. Ask me about our features, how to get started, or who we are." };
  const hit = ANSWERS.find((a) => a.test.test(low));
  return hit ? { text: hit.text, ctas: hit.ctas } : { text: FALLBACK };
}

export default function LandingAssistant({ onSignUp, onSignIn }: { onSignUp: () => void; onSignIn: () => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([{ id: nextId++, from: 'zenty', text: "Hi! I'm Zenty's guide. Ask me about our features, how to sign up or sign in, or about us." }]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  const ask = (q: string) => {
    const t = q.trim();
    if (!t) return;
    setInput('');
    setMsgs((xs) => [...xs, { id: nextId++, from: 'you', text: t }, { id: nextId++, from: 'zenty', ...answer(t) }]);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.section role="dialog" aria-label="Ask about Zenty"
            initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-4 z-[60] flex h-[min(560px,calc(100svh-8rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-lift sm:right-6">
            <header className="flex items-center gap-3 bg-primary-600 px-5 py-4 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><Sparkles className="h-5 w-5 text-saffron-300" /></span>
              <div className="flex-1">
                <p className="font-semibold">Ask about Zenty</p>
                <p className="text-xs text-white/75">Features, getting started, and about us</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            </header>
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-paper/60 px-4 py-4" aria-live="polite">
              {msgs.map((m) => (
                <div key={m.id} className={`flex ${m.from === 'you' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.from === 'you' ? 'rounded-br-md bg-ink text-white' : 'rounded-bl-md border border-line bg-white text-ink'}`}>
                    {m.text}
                    {m.ctas && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.ctas.includes('signup') && <button onClick={onSignUp} className="btn-primary !px-3 !py-1.5 !text-xs">Get started</button>}
                        {m.ctas.includes('signin') && <button onClick={onSignIn} className="btn-ghost !px-3 !py-1.5 !text-xs">Sign in</button>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto border-t border-line px-4 py-3">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="shrink-0 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-primary-300 hover:text-primary-700">{s}</button>
              ))}
            </div>
            <form onSubmit={submit} className="flex items-center gap-2 border-t border-line p-3">
              <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={200} placeholder="Ask about Zenty…" aria-label="Ask about Zenty"
                className="flex-1 rounded-xl border border-line bg-gray-50 px-4 py-2.5 text-sm text-ink placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-400" />
              <button type="submit" disabled={!input.trim()} aria-label="Send" className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white hover:bg-ink-700 disabled:opacity-40">
                <ArrowUp className="h-4 w-4" />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
      <motion.button onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close' : 'Ask about Zenty'} aria-expanded={open}
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-4 z-[60] flex h-14 items-center gap-2 rounded-full bg-ink pl-4 pr-5 text-white shadow-lift sm:right-6">
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5 text-saffron-300" />}
        <span className="text-sm font-semibold">{open ? 'Close' : 'Ask Zenty'}</span>
      </motion.button>
    </>
  );
}
