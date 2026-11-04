import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Loader2, Sparkles, X } from 'lucide-react';
import { budgetAPI, chatAPI, errorMessage, transactionAPI, type AssistantAction } from '../../services/api';

type Msg = { id: number; from: 'you' | 'zenty'; text: string; actions?: AssistantAction[]; done?: boolean };

const SUGGESTIONS = [
  'Make me a budget plan',
  'Plan my goals',
  'How much did I spend this month?',
  'Delete my last transaction',
  'Spent $12 on lunch',
];

let nextId = 1;

/** Zenty's assistant, available from every signed-in page. */
export default function AssistantWidget({ firstName }: { firstName?: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => [{
    id: nextId++, from: 'zenty',
    text: `Hi${firstName ? ` ${firstName}` : ''}! I can log or delete transactions, build a budget or goals game plan, and answer questions about your money. What would you like to do?`,
  }]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const push = (m: Omit<Msg, 'id'>) => setMsgs((xs) => [...xs, { ...m, id: nextId++ }]);
  const markDone = (id: number) => setMsgs((xs) => xs.map((m) => (m.id === id ? { ...m, done: true } : m)));

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput('');
    push({ from: 'you', text: t });
    setBusy(true);
    try {
      const { data } = await chatAPI.sendMessage(t);
      push({ from: 'zenty', text: data.message, actions: data.actions });
      if (data.type === 'text') window.dispatchEvent(new Event('zenty:data-changed'));
    } catch (err) {
      push({ from: 'zenty', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (msg: Msg, a: AssistantAction) => {
    markDone(msg.id);
    if (a.kind === 'dismiss') {
      push({ from: 'zenty', text: 'No problem, I left it as is.' });
      return;
    }
    setBusy(true);
    try {
      if (a.kind === 'delete_transaction') {
        await transactionAPI.delete(a.id);
        push({ from: 'zenty', text: 'Done. That transaction is deleted.' });
      } else if (a.kind === 'apply_budgets') {
        for (const b of a.budgets) await budgetAPI.create(b.category, b.monthly_limit);
        push({ from: 'zenty', text: `Done. I set ${a.budgets.length} monthly budgets. You'll find them on the Budgets page.` });
      }
      window.dispatchEvent(new Event('zenty:data-changed'));
    } catch (err) {
      push({ from: 'zenty', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="Zenty assistant"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-4 z-50 flex h-[min(620px,calc(100svh-8rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-lift sm:right-6"
          >
            <header className="flex items-center gap-3 bg-ink px-5 py-4 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-saffron-300/20"><Sparkles className="h-5 w-5 text-saffron-300" /></span>
              <div className="flex-1">
                <p className="font-semibold">Zenty Assistant</p>
                <p className="text-xs text-white/60">Works with your accounts, budgets and goals</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-paper/60 px-4 py-4" aria-live="polite">
              {msgs.map((m) => (
                <div key={m.id} className={`flex ${m.from === 'you' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.from === 'you' ? 'rounded-br-md bg-ink text-white' : 'rounded-bl-md border border-line bg-white text-ink'}`}>
                    {m.text}
                    {m.actions && !m.done && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.actions.map((a, i) => (
                          <button key={i} onClick={() => runAction(m, a)} disabled={busy}
                            className={i === 0 ? 'btn-primary !px-3 !py-1.5 !text-xs' : 'btn-ghost !px-3 !py-1.5 !text-xs'}>
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…</div>
              )}
            </div>

            {msgs.length <= 2 && (
              <div className="flex gap-2 overflow-x-auto border-t border-line px-4 py-3">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="shrink-0 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-primary-300 hover:text-primary-700">
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={submit} className="flex items-center gap-2 border-t border-line p-3">
              <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} maxLength={500}
                placeholder="Ask or tell Zenty something…" aria-label="Message Zenty"
                className="flex-1 rounded-xl border border-line bg-gray-50 px-4 py-2.5 text-sm text-ink placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-400" />
              <button type="submit" disabled={!input.trim() || busy} aria-label="Send"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white transition hover:bg-ink-700 disabled:opacity-40">
                <ArrowUp className="h-4 w-4" />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close assistant' : 'Open Zenty assistant'}
        aria-expanded={open}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-4 z-50 flex h-14 items-center gap-2 rounded-full bg-ink pl-4 pr-5 text-white shadow-lift sm:right-6"
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5 text-saffron-300" />}
        <span className="text-sm font-semibold">{open ? 'Close' : 'Ask Zenty'}</span>
      </motion.button>
    </>
  );
}
