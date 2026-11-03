import { type FormEvent, useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, User as UserIcon, ArrowLeft, Loader2 } from 'lucide-react';
import { authAPI, errorMessage, type PublicConfig, type User } from '../../services/api';
import GoogleButton from './GoogleButton';

export type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

interface Props {
  config: PublicConfig | null;
  initialMode?: AuthMode;
  resetToken?: string | null;
  onAuthed: (user: User) => void;
}

function strength(pw: string) {
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong', 'Very strong'];
  const colors = ['bg-red-400', 'bg-red-400', 'bg-matcha-400', 'bg-matcha-500', 'bg-primary-500', 'bg-primary-600'];
  return { score, label: labels[score], color: colors[score] };
}

export default function AuthCard({ config, initialMode = 'login', resetToken, onAuthed }: Props) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pw = useMemo(() => strength(password), [password]);

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setError('');
    setNotice('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'login') {
        const r = await authAPI.login(email, password);
        onAuthed(r.data.user);
      } else if (mode === 'signup') {
        const r = await authAPI.signup(name, email, password);
        onAuthed(r.data.user);
      } else if (mode === 'forgot') {
        const r = await authAPI.forgotPassword(email);
        setNotice(r.data.message);
      } else if (mode === 'reset' && resetToken) {
        await authAPI.resetPassword(resetToken, password);
        window.history.replaceState({}, '', '/');
        setPassword('');
        setMode('login');
        setNotice('Password updated. Sign in with your new password.');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const google = async (credential: string) => {
    setError('');
    setBusy(true);
    try {
      const r = await authAPI.google(credential);
      onAuthed(r.data.user);
    } catch (err) {
      setError(errorMessage(err, 'Google sign-in failed. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<AuthMode, [string, string]> = {
    login: ['Welcome back', 'Sign in to your Zenty account'],
    signup: ['Create your account', 'Free forever. Takes 30 seconds.'],
    forgot: ['Reset your password', "We'll email you a secure link"],
    reset: ['Choose a new password', 'Make it long and unique'],
  };

  const input =
    'w-full rounded-xl border border-line bg-white pl-11 pr-4 py-3 text-ink placeholder-gray-400 ' +
    'focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition';

  return (
    <div className="w-full max-w-md">
      {(mode === 'forgot' || mode === 'reset') && (
        <button onClick={() => switchMode('login')} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </button>
      )}
      <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">{titles[mode][0]}</h2>
      <p className="mt-1.5 text-gray-500">{titles[mode][1]}</p>

      {(mode === 'login' || mode === 'signup') && (
        <div className="mt-6 grid grid-cols-2 rounded-xl bg-gray-100 p-1 text-sm font-semibold">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`rounded-lg py-2 transition ${mode === m ? 'bg-white text-ink shadow-card' : 'text-gray-500 hover:text-ink'}`}
            >
              {m === 'login' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>
      )}

      {(mode === 'login' || mode === 'signup') && config?.google_client_id && (
        <>
          <div className="mt-6">
            <GoogleButton
              clientId={config.google_client_id}
              onCredential={google}
              text={mode === 'signup' ? 'signup_with' : 'signin_with'}
            />
          </div>
          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-gray-400">
            <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={submit} className={`space-y-4 ${config?.google_client_id && (mode === 'login' || mode === 'signup') ? '' : 'mt-6'}`}>
        {mode === 'signup' && (
          <label className="block relative">
            <span className="sr-only">Name</span>
            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input className={input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)}
              required maxLength={120} autoComplete="name" />
          </label>
        )}
        {mode !== 'reset' && (
          <label className="block relative">
            <span className="sr-only">Email</span>
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input className={input} type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
        )}
        {mode !== 'forgot' && (
          <div>
            <label className="block relative">
              <span className="sr-only">Password</span>
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input className={input + ' pr-12'} type={showPw ? 'text' : 'password'}
                placeholder={mode === 'login' ? 'Password' : 'At least 10 characters'} value={password}
                onChange={(e) => setPassword(e.target.value)} required maxLength={128}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </label>
            {(mode === 'signup' || mode === 'reset') && password && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${i < pw.score ? pw.color : 'bg-gray-200'}`} />
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500">{pw.label}. Mix upper & lowercase, numbers and symbols.</p>
              </div>
            )}
          </div>
        )}

        {mode === 'login' && (
          <div className="text-right -mt-1">
            <button type="button" onClick={() => switchMode('forgot')} className="text-sm font-medium text-primary-700 hover:text-primary-900">
              Forgot password?
            </button>
          </div>
        )}

        {error && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">{notice}</p>}

        <button type="submit" disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-ink py-3 font-semibold text-white shadow-lift hover:bg-ink-700 disabled:opacity-60 transition">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {{ login: 'Sign in', signup: 'Create account', forgot: 'Send reset link', reset: 'Update password' }[mode]}
        </button>
      </form>

      {mode === 'signup' && (
        <p className="mt-4 text-xs text-gray-500 text-center">
          By creating an account you agree to keep your login private. We'll send a welcome email to confirm your address.
        </p>
      )}
    </div>
  );
}
