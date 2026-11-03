// frontend/src/App.tsx
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  BadgeDollarSign,
  Building2,
  Eye,
  EyeOff,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  PiggyBank,
  Receipt,
  Settings,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
  MailWarning,
} from 'lucide-react';
import AuthPage from './components/Auth/AuthPage';
import LandingPage from './components/Landing/LandingPage';
import { LogoMark, Spinner } from './components/ui';
import { authAPI, chatAPI, errorMessage, type PublicConfig, type User } from './services/api';

// App pages load on demand after sign-in, keeping the welcome page light.
const Dashboard = lazy(() => import('./components/Dashboard/Dashbord'));
const ChatInterface = lazy(() => import('./components/Chat/ChatInterface'));
const TransactionsList = lazy(() => import('./components/Transactions/TransactionList'));
const Analytics = lazy(() => import('./components/Analytics/AnalyticsPage'));
const Savings = lazy(() => import('./components/Savings/SavingsPage'));
const Stocks = lazy(() => import('./components/Stocks/StocksPage'));
const Budget = lazy(() => import('./components/Budget/BudgetPage'));
const SettingsPage = lazy(() => import('./components/Settings/SettingsPage'));
const BankPage = lazy(() => import('./components/Bank/BankPage'));

type Banner = { kind: 'ok' | 'error'; text: string } | null;
type PublicView = 'landing' | 'signin' | 'signup';

const viewFromPath = (): PublicView =>
  window.location.pathname === '/signin' ? 'signin' : window.location.pathname === '/signup' ? 'signup' : 'landing';

const sections = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
      { id: 'transactions', name: 'Transactions', icon: Receipt },
      { id: 'bank', name: 'Accounts', icon: Building2 },
    ],
  },
  {
    label: 'Plan',
    items: [
      { id: 'budget', name: 'Budgets', icon: Wallet },
      { id: 'savings', name: 'Goals', icon: PiggyBank },
      { id: 'stocks', name: 'Investments', icon: BadgeDollarSign },
    ],
  },
  {
    label: 'Understand',
    items: [
      { id: 'analytics', name: 'Insights', icon: TrendingUp },
      { id: 'chat', name: 'Assistant', icon: MessageSquare },
    ],
  },
];

function readPref(key: string) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function writePref(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    /* storage unavailable: preference just won't persist */
  }
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [booting, setBooting] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [verifyNote, setVerifyNote] = useState('');
  const [privacy, setPrivacy] = useState(() => readPref('zenty:privacy'));
  const [quick, setQuick] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const quickRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<PublicView>(viewFromPath);

  const navigate = useCallback((v: PublicView) => {
    const path = v === 'landing' ? '/' : `/${v}`;
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setView(v);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPop = () => setView(viewFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('reset');

  const signedOut = useCallback(() => {
    setUser(null);
    setActiveTab('dashboard');
    window.history.replaceState({}, '', '/');
    setView('landing');
  }, []);

  useEffect(() => {
    window.addEventListener('zenty:signed-out', signedOut);
    return () => window.removeEventListener('zenty:signed-out', signedOut);
  }, [signedOut]);

  useEffect(() => {
    (async () => {
      authAPI.config().then((r) => setConfig(r.data)).catch(() => setConfig({ google_client_id: null, bank_linking: false }));
      const verifyToken = params.get('verify');
      if (verifyToken) {
        window.history.replaceState({}, '', '/');
        try {
          await authAPI.verifyEmail(verifyToken);
          setBanner({ kind: 'ok', text: 'Email verified. Thanks! Your account is fully set up.' });
        } catch (e) {
          setBanner({ kind: 'error', text: errorMessage(e) });
        }
        setView('signin');
      }
      try {
        const r = await authAPI.me();
        setUser(r.data.user);
      } catch {
        setUser(null);
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⌘K / Ctrl+K focuses quick add from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        quickRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const togglePrivacy = () => {
    setPrivacy((p) => {
      writePref('zenty:privacy', !p);
      return !p;
    });
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } finally {
      signedOut();
    }
  };

  const resendVerification = async () => {
    try {
      await authAPI.resendVerification();
      setVerifyNote('Verification email sent. Check your inbox.');
    } catch (e) {
      setVerifyNote(errorMessage(e));
    }
  };

  const submitQuick = async (e: FormEvent) => {
    e.preventDefault();
    if (!quick.trim()) return;
    setQuickBusy(true);
    try {
      const r = await chatAPI.sendMessage(quick.trim());
      setToast(String(r.data.message || 'Done.'));
      setQuick('');
      window.dispatchEvent(new Event('zenty:data-changed'));
    } catch (err) {
      setToast(errorMessage(err));
    } finally {
      setQuickBusy(false);
    }
  };

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!user || resetToken) {
    if (resetToken || view !== 'landing' || banner) {
      return (
        <AuthPage
          config={config}
          banner={banner}
          mode={resetToken ? 'reset' : view === 'signup' ? 'signup' : 'login'}
          resetToken={resetToken}
          onBack={() => {
            setBanner(null);
            navigate('landing');
          }}
          onAuthed={(u) => {
            setUser(u);
            setBanner(null);
            window.history.replaceState({}, '', '/');
          }}
        />
      );
    }
    return <LandingPage onSignIn={() => navigate('signin')} onSignUp={() => navigate('signup')} />;
  }

  const go = (id: string) => {
    setActiveTab(id);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'chat': return <ChatInterface />;
      case 'transactions': return <TransactionsList />;
      case 'savings': return <Savings />;
      case 'analytics': return <Analytics />;
      case 'stocks': return <Stocks />;
      case 'budget': return <Budget />;
      case 'bank': return <BankPage user={user} enabled={!!config?.bank_linking} onRequestVerify={resendVerification} />;
      case 'settings': return <SettingsPage user={user} onUserChange={setUser} onSignedOut={signedOut} />;
      default: return <Dashboard user={user} onNavigate={go} />;
    }
  };

  const initials = (user.name || user.email).split(/[\s@]/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');
  const emailOn = config?.email_enabled !== false;

  const navButton = (item: { id: string; name: string; icon: typeof Menu }) => {
    const active = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => go(item.id)}
        aria-current={active ? 'page' : undefined}
        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors ${
          active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
        }`}
      >
        <item.icon className={`h-[18px] w-[18px] ${active ? 'text-matcha-300' : 'text-white/50 group-hover:text-white/80'}`} />
        <span>{item.name}</span>
        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-saffron-300" />}
      </button>
    );
  };

  return (
    <div className={`min-h-screen bg-paper ${privacy ? 'privacy' : ''}`}>
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-ink text-white transition-transform lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 pt-7 pb-6">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-9 w-9" />
            <span className="font-display text-2xl font-semibold tracking-tight">Zenty</span>
          </div>
          <button onClick={() => setMenuOpen(false)} className="lg:hidden p-1 text-white/60" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-4 pb-6">
          {sections.map((s) => (
            <div key={s.label}>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">{s.label}</p>
              <div className="space-y-0.5">{s.items.map(navButton)}</div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4 space-y-1">
          {navButton({ id: 'settings', name: 'Settings', icon: Settings })}
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/5 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-saffron-300 to-primary-400 text-sm font-bold text-ink">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name || 'You'}</p>
              <p className="truncate text-xs text-white/50">{user.email}</p>
            </div>
            <button onClick={logout} aria-label="Sign out" title="Sign out" className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      {menuOpen && <div className="fixed inset-0 z-30 bg-ink/40 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} />}

      <div className="lg:pl-[260px]">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/85 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-8">
            <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="lg:hidden -ml-1 rounded-lg p-2 text-ink">
              <Menu className="h-5 w-5" />
            </button>
            <form onSubmit={submitQuick} className="relative flex-1 max-w-xl">
              <Sparkles className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-saffron-500" />
              <input
                ref={quickRef}
                value={quick}
                onChange={(e) => setQuick(e.target.value)}
                placeholder='Quick add: "spent 12 on coffee" or "got paid 2000"'
                aria-label="Quick add a transaction or ask a question"
                className="w-full rounded-xl border border-line bg-white py-2.5 pl-10 pr-16 text-sm text-ink placeholder-gray-400 shadow-card focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
              {quickBusy ? (
                <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
              ) : (
                <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-500 sm:block">
                  ⌘K
                </kbd>
              )}
            </form>
            <button
              onClick={togglePrivacy}
              aria-pressed={privacy}
              title={privacy ? 'Show amounts' : 'Hide amounts (privacy mode)'}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                privacy ? 'border-ink bg-ink text-white' : 'border-line bg-white text-gray-600 hover:text-ink'
              }`}
            >
              {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
          {!user.email_verified && (
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-saffron-300/60 bg-saffron-50 px-5 py-3.5">
              <MailWarning className="h-5 w-5 shrink-0 text-saffron-600" />
              <p className="flex-1 text-sm text-ink">
                {emailOn ? (
                  <>
                    <strong>Verify your email</strong> to unlock bank linking and stock alerts. We sent a link to {user.email}.
                  </>
                ) : (
                  <>
                    <strong>Email verification is coming soon.</strong> Bank linking and stock alerts will unlock once it's switched on.
                  </>
                )}
              </p>
              {emailOn &&
                (verifyNote ? (
                  <span className="text-sm text-gray-600">{verifyNote}</span>
                ) : (
                  <button onClick={resendVerification} className="text-sm font-semibold text-primary-700 hover:text-primary-900">
                    Resend email
                  </button>
                ))}
            </div>
          )}
          <Suspense fallback={<Spinner />}>{renderContent()}</Suspense>
        </main>
      </div>

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 rounded-2xl bg-ink px-5 py-4 text-sm text-white shadow-lift whitespace-pre-line">
          <div className="flex gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-saffron-300" />
            <p className="flex-1">{toast}</p>
            <button onClick={() => setToast(null)} aria-label="Dismiss" className="text-white/50 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
