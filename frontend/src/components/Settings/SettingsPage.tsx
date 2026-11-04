import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, Bell, Check, Download, KeyRound, Laptop, LogOut, Palette, Phone, ShieldCheck, Smartphone, Trash2, User as UserIcon, Wallet,
} from 'lucide-react';
import { accountAPI, authAPI, errorMessage, type DeviceSession, type SecurityEvent, type User } from '../../services/api';
import { PageHeader } from '../ui';

interface Props {
  user: User;
  onUserChange: (u: User) => void;
  onSignedOut: () => void;
}

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: UserIcon },
  { id: 'personalize', label: 'Personalize', icon: Palette },
  { id: 'budgeting', label: 'Budgeting', icon: Wallet },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'activity', label: 'Security activity', icon: Activity },
  { id: 'privacy', label: 'Privacy & data', icon: Download },
];

const CURRENCIES = [
  ['USD', 'US dollar ($)'], ['CAD', 'Canadian dollar (CA$)'], ['EUR', 'Euro (€)'], ['GBP', 'British pound (£)'],
  ['AUD', 'Australian dollar (A$)'], ['NZD', 'New Zealand dollar (NZ$)'], ['INR', 'Indian rupee (₹)'], ['JPY', 'Japanese yen (¥)'],
  ['SGD', 'Singapore dollar (S$)'], ['CHF', 'Swiss franc (CHF)'], ['MXN', 'Mexican peso (MX$)'],
];
const START_PAGES = [
  ['dashboard', 'Dashboard'], ['transactions', 'Transactions'], ['bank', 'Accounts'], ['budget', 'Budgets'],
  ['savings', 'Goals'], ['subscriptions', 'Subscriptions'], ['stocks', 'Investments'], ['analytics', 'Insights'],
];

const field = 'input';
type Status = { ok: boolean; text: string } | null;

function Section({ id, icon: Icon, title, description, children, danger }: {
  id: string; icon: typeof Bell; title: string; description?: string; children: ReactNode; danger?: boolean;
}) {
  return (
    <section id={`settings-${id}`} className={`card scroll-mt-24 p-6 ${danger ? '!border-red-200' : ''}`}>
      <h2 className={`flex items-center gap-2 text-lg font-semibold ${danger ? 'text-red-700' : 'text-ink'}`}><Icon className="h-5 w-5" /> {title}</h2>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StatusLine({ s }: { s: Status }) {
  if (!s) return null;
  return <p role="status" className={`mt-3 text-sm ${s.ok ? 'text-primary-700' : 'text-red-600'}`}>{s.text}</p>;
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? 'bg-primary-500' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function deviceName(ua: string) {
  const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Browser';
  return { label: `${browser} on ${os}`, mobile: /iPhone|Android|Mobile/.test(ua) };
}

export default function SettingsPage({ user, onUserChange, onSignedOut }: Props) {
  // profile & preferences
  const [name, setName] = useState(user.name);
  const [currency, setCurrency] = useState(user.currency || 'USD');
  const [startPage, setStartPage] = useState(user.start_page || 'dashboard');
  const [alertPct, setAlertPct] = useState(user.budget_alert_pct || 85);
  const [savingsTarget, setSavingsTarget] = useState(user.savings_target_pct || 20);
  const [alerts, setAlerts] = useState(user.stock_alerts);
  const [threshold, setThreshold] = useState(user.stock_alert_threshold);
  const [prefStatus, setPrefStatus] = useState<Record<string, Status>>({});

  // security
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phonePw, setPhonePw] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [phoneStatus, setPhoneStatus] = useState<Status>(null);
  const [mfaPw, setMfaPw] = useState('');
  const [mfaStatus, setMfaStatus] = useState<Status>(null);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwStatus, setPwStatus] = useState<Status>(null);
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);

  // danger zone
  const [confirmEmail, setConfirmEmail] = useState('');
  const [delPw, setDelPw] = useState('');
  const [delStatus, setDelStatus] = useState<Status>(null);
  const [busy, setBusy] = useState('');

  const loadDevices = () => {
    accountAPI.sessions().then((r) => setDevices(r.data.sessions)).catch(() => undefined);
    accountAPI.securityEvents().then((r) => setEvents(r.data.events)).catch(() => undefined);
  };
  useEffect(() => {
    loadDevices();
  }, []);

  const save = async (key: string, data: Parameters<typeof accountAPI.updateProfile>[0]) => {
    setBusy(key);
    try {
      const r = await accountAPI.updateProfile(data);
      onUserChange(r.data.user);
      setPrefStatus((s) => ({ ...s, [key]: { ok: true, text: 'Saved.' } }));
      window.dispatchEvent(new Event('zenty:data-changed'));
    } catch (err) {
      setPrefStatus((s) => ({ ...s, [key]: { ok: false, text: errorMessage(err) } }));
    } finally {
      setBusy('');
    }
  };

  const startPhoneChange = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('phone');
    setPhoneStatus(null);
    try {
      const r = await accountAPI.changePhone(newPhone, user.has_password ? phonePw : null);
      onUserChange(r.data.user);
      setPhonePw('');
      if (r.data.verification_sent) {
        setAwaitingCode(true);
        setPhoneStatus({ ok: true, text: 'We texted a 6-digit code to your new number.' });
      } else {
        setPhoneEditing(false);
        setPhoneStatus({ ok: true, text: 'Phone number updated.' });
      }
    } catch (err) {
      setPhoneStatus({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy('');
    }
  };

  const confirmPhone = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('phone');
    try {
      const r = await accountAPI.confirmPhone(phoneCode);
      onUserChange(r.data.user);
      setAwaitingCode(false);
      setPhoneEditing(false);
      setPhoneCode('');
      setNewPhone('');
      setPhoneStatus({ ok: true, text: 'New number confirmed.' });
    } catch (err) {
      setPhoneStatus({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy('');
    }
  };

  const toggleMfa = async (enabled: boolean) => {
    if (user.has_password && !mfaPw) {
      setMfaStatus({ ok: false, text: 'Enter your current password to change two-step sign-in.' });
      return;
    }
    setBusy('mfa');
    try {
      const r = await accountAPI.setMfa(enabled, user.has_password ? mfaPw : null);
      onUserChange(r.data.user);
      setMfaPw('');
      setMfaStatus({ ok: true, text: enabled ? 'Two-step sign-in is on.' : 'Two-step sign-in is off.' });
    } catch (err) {
      setMfaStatus({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy('');
    }
  };

  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setPwStatus({ ok: false, text: "New passwords don't match." });
      return;
    }
    setBusy('pw');
    try {
      await accountAPI.changePassword(user.has_password ? curPw : null, newPw);
      setCurPw(''); setNewPw(''); setConfirmPw('');
      setPwStatus({ ok: true, text: 'Password updated. Other devices have been signed out.' });
      if (!user.has_password) onUserChange({ ...user, has_password: true });
      loadDevices();
    } catch (err) {
      setPwStatus({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy('');
    }
  };

  const revoke = async (d: DeviceSession) => {
    await accountAPI.revokeSession(d.id);
    if (d.current) onSignedOut();
    else loadDevices();
  };

  const exportData = async () => {
    const r = await accountAPI.exportData();
    const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `zenty-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const deleteAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!window.confirm('This permanently deletes your Zenty account and all data. Continue?')) return;
    setBusy('delete');
    try {
      await accountAPI.deleteAccount(confirmEmail, user.has_password ? delPw : null);
      onSignedOut();
    } catch (err) {
      setDelStatus({ ok: false, text: errorMessage(err) });
      setBusy('');
    }
  };

  const go = (id: string) => document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div>
      <PageHeader title="Settings" subtitle="Make Zenty yours, and keep your account secure." />
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="hidden lg:block" aria-label="Settings sections">
          <ul className="sticky top-24 space-y-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button onClick={() => go(s.id)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 hover:bg-white hover:text-ink">
                  <s.icon className="h-4 w-4" /> {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-3xl space-y-6">
          {/* Profile */}
          <Section id="profile" icon={UserIcon} title="Profile">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-sm font-medium text-gray-700">Name</span>
                <input className={`${field} mt-1`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
              <label className="block"><span className="text-sm font-medium text-gray-700">Email</span>
                <input className={`${field} mt-1 !bg-gray-50 !text-gray-500`} value={user.email} disabled /></label>
            </div>
            <p className="mt-3 text-sm text-gray-500">{user.email_verified ? '✓ Email verified' : 'Email not verified yet'} · {user.google_linked ? 'Google sign-in linked' : 'Email & password sign-in'}</p>
            <button className="btn-primary mt-4" disabled={busy === 'profile' || !name.trim()} onClick={() => save('profile', { name })}>Save</button>
            <StatusLine s={prefStatus.profile ?? null} />
          </Section>

          {/* Personalize */}
          <Section id="personalize" icon={Palette} title="Personalize" description="How Zenty looks and where it opens.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-sm font-medium text-gray-700">Display currency</span>
                <select className={`${field} mt-1`} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
                </select>
                <span className="mt-1 block text-xs text-gray-500">Changes the symbol shown. Amounts aren't converted.</span>
              </label>
              <label className="block"><span className="text-sm font-medium text-gray-700">Open Zenty on</span>
                <select className={`${field} mt-1`} value={startPage} onChange={(e) => setStartPage(e.target.value)}>
                  {START_PAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            </div>
            <button className="btn-primary mt-4" disabled={busy === 'personalize'} onClick={() => save('personalize', { currency, start_page: startPage })}>Save</button>
            <StatusLine s={prefStatus.personalize ?? null} />
          </Section>

          {/* Budgeting */}
          <Section id="budgeting" icon={Wallet} title="Budgeting" description="Tune how Zenty judges your budgets and savings.">
            <label className="block">
              <span className="flex justify-between text-sm font-medium text-gray-700"><span>Warn me when a budget is</span><span className="num text-ink">{alertPct}% spent</span></span>
              <input type="range" min={50} max={100} step={5} value={alertPct} onChange={(e) => setAlertPct(Number(e.target.value))} className="mt-2 w-full accent-primary-600" />
              <span className="block text-xs text-gray-500">Budget bars turn saffron at this point, and red once you go over.</span>
            </label>
            <label className="mt-5 block">
              <span className="flex justify-between text-sm font-medium text-gray-700"><span>My savings-rate target</span><span className="num text-ink">{savingsTarget}% of income</span></span>
              <input type="range" min={5} max={60} step={1} value={savingsTarget} onChange={(e) => setSavingsTarget(Number(e.target.value))} className="mt-2 w-full accent-primary-600" />
              <span className="block text-xs text-gray-500">Used by your Zen Score. Many planners suggest 20%.</span>
            </label>
            <button className="btn-primary mt-4" disabled={busy === 'budgeting'} onClick={() => save('budgeting', { budget_alert_pct: alertPct, savings_target_pct: savingsTarget })}>Save</button>
            <StatusLine s={prefStatus.budgeting ?? null} />
          </Section>

          {/* Alerts */}
          <Section id="alerts" icon={Bell} title="Alerts">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-ink">Daily email when my stocks move</p>
                <p className="text-sm text-gray-500">Sent after market close on weekdays, only when something moved enough.</p>
              </div>
              <Toggle checked={alerts} onChange={setAlerts} label="Stock movement emails" />
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-gray-700">Alert when a stock moves at least <strong>{threshold}%</strong> in a day</span>
              <input type="range" min={0.5} max={15} step={0.5} value={threshold} disabled={!alerts}
                onChange={(e) => setThreshold(Number(e.target.value))} className="mt-2 w-full accent-primary-600" />
            </label>
            {!user.email_verified && <p className="mt-2 text-sm text-saffron-700">Verify your email to receive alerts.</p>}
            <button className="btn-primary mt-4" disabled={busy === 'alerts'} onClick={() => save('alerts', { stock_alerts: alerts, stock_alert_threshold: threshold })}>Save</button>
            <StatusLine s={prefStatus.alerts ?? null} />
          </Section>

          {/* Security */}
          <Section id="security" icon={ShieldCheck} title="Security">
            {/* Phone */}
            <div className="rounded-2xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100"><Phone className="h-5 w-5 text-gray-600" /></span>
                  <div>
                    <p className="font-medium text-ink">Phone number</p>
                    <p className="text-sm text-gray-500">
                      {user.phone_masked || 'No phone on file'}
                      {user.phone_masked && (user.phone_verified ? <span className="ml-2 text-primary-700">✓ Verified</span> : <span className="ml-2 text-saffron-700">Not verified</span>)}
                    </p>
                  </div>
                </div>
                {!phoneEditing && <button onClick={() => { setPhoneEditing(true); setPhoneStatus(null); }} className="btn-ghost">{user.phone_masked ? 'Change number' : 'Add number'}</button>}
              </div>
              {phoneEditing && !awaitingCode && (
                <form onSubmit={startPhoneChange} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input className={field} type="tel" inputMode="tel" autoComplete="tel" placeholder="New mobile number" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} required />
                  {user.has_password && <input className={field} type="password" autoComplete="current-password" placeholder="Current password" value={phonePw} onChange={(e) => setPhonePw(e.target.value)} required />}
                  <div className="flex gap-2 sm:col-span-2">
                    <button className="btn-primary" disabled={busy === 'phone'}>Continue</button>
                    <button type="button" className="btn-ghost" onClick={() => setPhoneEditing(false)}>Cancel</button>
                  </div>
                </form>
              )}
              {awaitingCode && (
                <form onSubmit={confirmPhone} className="mt-4 flex flex-wrap gap-2">
                  <input className={`${field} num max-w-[200px] text-center tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••"
                    value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-label="6-digit code" />
                  <button className="btn-primary" disabled={busy === 'phone' || phoneCode.length !== 6}>Confirm</button>
                  <button type="button" className="btn-ghost" onClick={() => { setAwaitingCode(false); setPhoneEditing(false); }}>Cancel</button>
                </form>
              )}
              <StatusLine s={phoneStatus} />
            </div>

            {/* Two-step */}
            <div className="mt-4 rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100"><Smartphone className="h-5 w-5 text-gray-600" /></span>
                  <div>
                    <p className="font-medium text-ink">Two-step sign-in</p>
                    <p className="text-sm text-gray-500">Ask for a texted code every time you sign in with your password.</p>
                  </div>
                </div>
                <Toggle checked={!!user.mfa_enabled} onChange={toggleMfa} label="Two-step sign-in" disabled={busy === 'mfa'} />
              </div>
              {user.has_password && (
                <input className={`${field} mt-3 max-w-sm`} type="password" autoComplete="current-password" placeholder="Current password (to change this)"
                  value={mfaPw} onChange={(e) => setMfaPw(e.target.value)} />
              )}
              <StatusLine s={mfaStatus} />
            </div>

            {/* Password */}
            <div className="mt-4 rounded-2xl border border-line p-4">
              <p className="flex items-center gap-2 font-medium text-ink"><KeyRound className="h-4 w-4" /> {user.has_password ? 'Change password' : 'Add a password'}</p>
              <form onSubmit={changePw} className="mt-3 grid gap-3 sm:grid-cols-3">
                {user.has_password && <input className={field} type="password" placeholder="Current password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" required />}
                <input className={field} type="password" placeholder="New password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" required />
                <input className={field} type="password" placeholder="Confirm new password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" required />
                <div className="sm:col-span-3"><button className="btn-primary" disabled={busy === 'pw'}>Update password</button></div>
              </form>
              <StatusLine s={pwStatus} />
            </div>

            {/* Devices */}
            <div className="mt-4 rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 font-medium text-ink"><Laptop className="h-4 w-4" /> Where you're signed in</p>
                <button onClick={async () => { await authAPI.logoutEverywhere(); onSignedOut(); }} className="text-sm font-semibold text-red-600 hover:text-red-700">
                  <LogOut className="mr-1 inline h-4 w-4" />Sign out everywhere
                </button>
              </div>
              <ul className="mt-3 divide-y divide-line">
                {devices.map((d) => {
                  const dn = deviceName(d.device);
                  const Icon = dn.mobile ? Smartphone : Laptop;
                  return (
                    <li key={d.id} className="flex items-center gap-3 py-3">
                      <Icon className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-ink">{dn.label} {d.current && <span className="ml-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700"><Check className="mr-0.5 inline h-3 w-3" />This device</span>}</p>
                        <p className="text-xs text-gray-500">Signed in {new Date(d.created_at + 'Z').toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                      </div>
                      <button onClick={() => revoke(d)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-ink">Sign out</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Section>

          {/* Security activity */}
          <Section id="activity" icon={Activity} title="Recent security activity"
            description="Sign-ins and security changes on your account. If something looks unfamiliar, change your password and sign out everywhere.">
            {events.length === 0 ? <p className="text-sm text-gray-500">No activity yet.</p> : (
              <ul className="divide-y divide-line">
                {events.map((e) => {
                  const label: Record<string, string> = {
                    signup: 'Account created', login: 'Signed in', login_failed: 'Failed sign-in attempt', password_changed: 'Password changed',
                    password_reset: 'Password reset', phone_changed: 'Phone number changed', mfa_enabled: 'Two-step sign-in turned on',
                    mfa_disabled: 'Two-step sign-in turned off', session_revoked: 'A device was signed out', signout_all: 'Signed out everywhere',
                  };
                  const warn = e.kind === 'login_failed' || e.kind === 'mfa_disabled';
                  return (
                    <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className={warn ? 'font-medium text-red-600' : 'text-ink'}>{label[e.kind] ?? e.kind}</span>
                      <span className="text-right text-xs text-gray-500">{e.device} · {new Date(e.created_at + 'Z').toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* Privacy */}
          <Section id="privacy" icon={Download} title="Privacy & data" description="Your data is yours. Take it with you any time.">
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={exportData} className="btn-ghost"><Download className="h-4 w-4" /> Download my data</button>
              <a href="/privacy" className="text-sm font-medium text-primary-700 hover:text-primary-900">Privacy Policy</a>
              <a href="/terms" className="text-sm font-medium text-primary-700 hover:text-primary-900">Terms of Service</a>
            </div>
          </Section>

          <Section id="delete" icon={Trash2} title="Delete account" danger>
            <form onSubmit={deleteAccount} className="space-y-3">
              <p className="text-sm text-gray-600">Permanently deletes your account, transactions, budgets, goals, subscriptions and stocks, and revokes all bank connections. This can't be undone.</p>
              <input className={field} placeholder={`Type ${user.email} to confirm`} value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} required />
              {user.has_password && <input className={field} type="password" placeholder="Password" value={delPw} onChange={(e) => setDelPw(e.target.value)} autoComplete="current-password" required />}
              <button disabled={busy === 'delete' || confirmEmail.trim().toLowerCase() !== user.email}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">Delete my account</button>
              <StatusLine s={delStatus} />
            </form>
          </Section>
        </div>
      </div>
    </div>
  );
}
