import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Eye, EyeOff, Loader2, Lock, Mail, MessageSquareText, Phone, ShieldCheck, User as UserIcon, X } from 'lucide-react';
import { authAPI, errorMessage, type PublicConfig, type User } from '../../services/api';
import GoogleButton from './GoogleButton';

export type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';
type Step = AuthMode | 'verifyPhone' | 'mfa';

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
  const colors = ['bg-red-400', 'bg-red-400', 'bg-saffron-400', 'bg-primary-400', 'bg-primary-500', 'bg-primary-600'];
  return { score, label: labels[score], color: colors[score] };
}

const RESEND_SECONDS = 30;

export default function AuthCard({ config, initialMode = 'login', resetToken, onAuthed }: Props) {
  const [step, setStep] = useState<Step>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState('');
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pw = useMemo(() => strength(password), [password]);
  const mismatch = step === 'signup' && confirm.length > 0 && confirm !== password;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const switchMode = (m: AuthMode) => {
    setStep(m);
    setError('');
    setNotice('');
    setCode('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (step === 'signup' && password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      if (step === 'login') {
        const r = await authAPI.login(email, password);
        if ('mfa_required' in r.data) {
          setTicket(r.data.mfa_ticket);
          setMaskedPhone(r.data.phone_masked);
          setCode('');
          setCooldown(RESEND_SECONDS);
          setStep('mfa');
        } else {
          onAuthed(r.data.user);
        }
      } else if (step === 'signup') {
        const r = await authAPI.signup(name, email, password, confirm, phone);
        if (r.data.phone_verification_required) {
          setPendingUser(r.data.user);
          setMaskedPhone(r.data.user.phone_masked ?? null);
          setCooldown(RESEND_SECONDS);
          setStep('verifyPhone');
        } else {
          onAuthed(r.data.user);
        }
      } else if (step === 'verifyPhone') {
        const r = await authAPI.phoneVerify(code);
        onAuthed(r.data.user);
      } else if (step === 'mfa') {
        const r = await authAPI.mfaVerify(ticket, code);
        onAuthed(r.data.user);
      } else if (step === 'forgot') {
        const r = await authAPI.forgotPassword(email);
        setNotice(r.data.message);
      } else if (step === 'reset' && resetToken) {
        await authAPI.resetPassword(resetToken, password);
        window.history.replaceState({}, '', '/signin');
        setPassword('');
        setStep('login');
        setNotice('Password updated. Sign in with your new password.');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    try {
      if (step === 'mfa') await authAPI.mfaResend(ticket);
      else await authAPI.phoneResend();
      setNotice('A new code is on its way.');
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(errorMessage(err));
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

  const titles: Record<Step, [string, string]> = {
    login: ['Welcome back', 'Sign in to your Zenty account'],
    signup: ['Create your account', 'Free forever. Takes 30 seconds.'],
    forgot: ['Reset your password', "We'll email you a secure link"],
    reset: ['Choose a new password', 'Make it long and unique'],
    verifyPhone: ['Verify your phone', `We texted a 6-digit code to ${maskedPhone ?? 'your phone'}.`],
    mfa: ['Two-step sign-in', `Enter the 6-digit code we texted to ${maskedPhone ?? 'your phone'}.`],
  };

  const input =
    'w-full rounded-xl border border-line bg-white pl-11 pr-4 py-3 text-ink placeholder-gray-400 ' +
    'focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition';
  const isCodeStep = step === 'verifyPhone' || step === 'mfa';
  const submitLabel: Record<Step, string> = {
    login: 'Sign in', signup: 'Create account', forgot: 'Send reset link', reset: 'Update password',
    verifyPhone: 'Verify and continue', mfa: 'Verify and sign in',
  };

  return (
    <div className="w-full max-w-md">
      {(step === 'forgot' || step === 'reset' || step === 'mfa') && (
        <button onClick={() => switchMode('login')} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </button>
      )}
      {isCodeStep && (
        <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50">
          <MessageSquareText className="h-6 w-6 text-primary-600" />
        </span>
      )}
      <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">{titles[step][0]}</h2>
      <p className="mt-1.5 text-gray-500">{titles[step][1]}</p>

      {(step === 'login' || step === 'signup') && (
        <div className="mt-6 grid grid-cols-2 rounded-xl bg-gray-100 p-1 text-sm font-semibold">
          {(['login', 'signup'] as const).map((m) => (
            <button key={m} type="button" onClick={() => switchMode(m)}
              className={`rounded-lg py-2 transition ${step === m ? 'bg-white text-ink shadow-card' : 'text-gray-500 hover:text-ink'}`}>
              {m === 'login' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>
      )}

      {(step === 'login' || step === 'signup') && config?.google_client_id && (
        <>
          <div className="mt-6">
            <GoogleButton clientId={config.google_client_id} onCredential={google} text={step === 'signup' ? 'signup_with' : 'signin_with'} />
          </div>
          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-gray-400">
            <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={submit} className={`space-y-4 ${config?.google_client_id && (step === 'login' || step === 'signup') ? '' : 'mt-6'}`}>
        {isCodeStep ? (
          <>
            <label className="block">
              <span className="sr-only">6-digit code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="••••••"
                aria-label="6-digit code"
                className="num w-full rounded-xl border border-line bg-white py-3.5 text-center font-display text-3xl tracking-[0.6em] text-ink placeholder-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </label>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-gray-500"><ShieldCheck className="h-4 w-4 text-primary-600" /> Codes expire in 10 minutes</span>
              <button type="button" onClick={resend} disabled={cooldown > 0} className="font-medium text-primary-700 hover:text-primary-900 disabled:text-gray-400">
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </>
        ) : (
          <>
            {step === 'signup' && (
              <label className="block relative">
                <span className="sr-only">Name</span>
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input className={input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoComplete="name" />
              </label>
            )}
            {step !== 'reset' && (
              <label className="block relative">
                <span className="sr-only">Email</span>
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input className={input} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </label>
            )}
            {step === 'signup' && (
              <div>
                <label className="block relative">
                  <span className="sr-only">Mobile number</span>
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input className={input} type="tel" placeholder="Mobile number, e.g. +1 415 555 0123" value={phone}
                    onChange={(e) => setPhone(e.target.value)} required maxLength={24} autoComplete="tel" inputMode="tel" />
                </label>
                <p className="mt-1.5 text-xs text-gray-500">Used only to text you sign-in codes, for two-step security.</p>
              </div>
            )}
            {step !== 'forgot' && (
              <div>
                <label className="block relative">
                  <span className="sr-only">Password</span>
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input className={input + ' pr-12'} type={showPw ? 'text' : 'password'}
                    placeholder={step === 'login' ? 'Password' : 'Password (at least 10 characters)'} value={password}
                    onChange={(e) => setPassword(e.target.value)} required maxLength={128}
                    autoComplete={step === 'login' ? 'current-password' : 'new-password'} />
                  <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </label>
                {(step === 'signup' || step === 'reset') && password && (
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
            {step === 'signup' && (
              <div>
                <label className="block relative">
                  <span className="sr-only">Confirm password</span>
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input className={`${input} pr-12 ${mismatch ? '!border-red-300 focus:!ring-red-300' : ''}`} type={showPw ? 'text' : 'password'}
                    placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required maxLength={128}
                    autoComplete="new-password" aria-invalid={mismatch} />
                  {confirm && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2">
                      {mismatch ? <X className="h-5 w-5 text-red-500" /> : <Check className="h-5 w-5 text-primary-600" />}
                    </span>
                  )}
                </label>
                {mismatch && <p className="mt-1.5 text-xs font-medium text-red-600">Passwords don't match yet.</p>}
              </div>
            )}
            {step === 'login' && (
              <div className="text-right -mt-1">
                <button type="button" onClick={() => switchMode('forgot')} className="text-sm font-medium text-primary-700 hover:text-primary-900">Forgot password?</button>
              </div>
            )}
          </>
        )}

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">{notice}</p>}

        <button type="submit" disabled={busy || mismatch || (isCodeStep && code.length !== 6)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 font-semibold text-white shadow-lift transition hover:bg-ink-700 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel[step]}
        </button>
        {step === 'verifyPhone' && pendingUser && (
          <p className="text-center text-xs text-gray-500">
            Didn't get a text? Wait a moment, then tap Resend code.
          </p>
        )}
      </form>

      {step === 'signup' && (
        <p className="mt-4 text-center text-xs text-gray-500">
          By creating an account you agree to Zenty's{' '}
          <a href="/terms" target="_blank" rel="noreferrer" className="font-medium text-primary-700 underline underline-offset-2">Terms of Service</a> and{' '}
          <a href="/privacy" target="_blank" rel="noreferrer" className="font-medium text-primary-700 underline underline-offset-2">Privacy Policy</a>,
          and to receive account emails and texted security codes. We'll send a welcome email to confirm your address.
        </p>
      )}
    </div>
  );
}
