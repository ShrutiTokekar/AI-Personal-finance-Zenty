// frontend/src/App.tsx
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { BadgeDollarSign, Building2, LayoutDashboard, Loader2, LogOut, Menu, MessageSquare, PiggyBank, Receipt, Settings, TrendingUp, Wallet, X } from 'lucide-react';
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
import WelcomePage from './components/Auth/WelcomePage';
import { authAPI, errorMessage, type PublicConfig, type User } from './services/api';

type Banner = { kind: 'ok' | 'error'; text: string } | null;

const navigation = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', name: 'Transactions', icon: Receipt },
  { id: 'bank', name: 'Bank accounts', icon: Building2 },
  { id: 'budget', name: 'Budget', icon: Wallet },
  { id: 'savings', name: 'Savings', icon: PiggyBank },
  { id: 'stocks', name: 'Stocks', icon: BadgeDollarSign },
  { id: 'analytics', name: 'Insights', icon: TrendingUp },
  { id: 'chat', name: 'Assistant', icon: MessageSquare },
  { id: 'settings', name: 'Settings', icon: Settings },
];

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [booting, setBooting] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [verifyNote, setVerifyNote] = useState('');

  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('reset');

  const signedOut = useCallback(() => {
    setUser(null);
    setActiveTab('dashboard');
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

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!user || resetToken) {
    return (
      <WelcomePage
        config={config}
        banner={banner}
        initialMode={resetToken ? 'reset' : 'login'}
        resetToken={resetToken}
        onAuthed={(u) => {
          setUser(u);
          setBanner(null);
        }}
      />
    );
  }

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
      default: return <Dashboard />;
    }
  };

  const initials = (user.name || user.email).split(/[\s@]/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');

  return (
    <div className="min-h-screen bg-orange-100">
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-orange-50 border-b border-orange-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
          <span className="text-lg text-yellow-950 font-extrabold font-serif">Zenty</span>
        </div>
        <button onClick={() => setMenuOpen((o) => !o)} aria-label="Toggle menu" className="p-2 text-orange-900">
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-orange-50 border-r border-orange-200 transform transition-transform lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center space-x-2 px-6 py-6 border-b border-orange-200">
            <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
            <span className="text-xl text-yellow-950 font-extrabold font-serif">Zenty</span>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors font-semibold ${
                  activeTab === item.id ? 'bg-orange-200 text-amber-950' : 'text-orange-900 hover:bg-orange-100'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </button>
            ))}
          </nav>

          <div className="border-t border-orange-200 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-600 font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-amber-950">{user.name || 'You'}</p>
                <p className="truncate text-xs text-stone-500">{user.email}</p>
              </div>
              <button onClick={logout} aria-label="Sign out" title="Sign out" className="p-2 text-orange-800 hover:text-red-600">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>
      {menuOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <main className="lg:ml-64 p-4 sm:p-8">
        {!user.email_verified && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm text-amber-900">
              <strong>Please verify your email.</strong> We sent a link to {user.email}. Verifying unlocks bank linking and stock alerts.
            </p>
            {verifyNote ? (
              <span className="text-sm text-amber-900">{verifyNote}</span>
            ) : (
              <button onClick={resendVerification} className="text-sm font-semibold text-orange-700 hover:text-orange-900">Resend email</button>
            )}
          </div>
        )}
        <Suspense fallback={<div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>}>
          {renderContent()}
        </Suspense>
      </main>
    </div>
  );
}

export default App;
