import { type FormEvent, type ReactNode, useState } from 'react';
import { Bell, Download, KeyRound, LogOut, ShieldAlert, Trash2, User as UserIcon } from 'lucide-react';
import { accountAPI, authAPI, errorMessage, type User } from '../../services/api';

interface Props {
  user: User;
  onUserChange: (u: User) => void;
  onSignedOut: () => void;
}

function Card({ icon: Icon, title, children, danger }: { icon: typeof Bell; title: string; children: ReactNode; danger?: boolean }) {
  return (
    <section className={`rounded-2xl bg-white border p-6 ${danger ? 'border-red-200' : 'border-orange-100'}`}>
      <h2 className={`flex items-center gap-2 text-lg font-bold ${danger ? 'text-red-700' : 'text-amber-950'}`}>
        <Icon className="h-5 w-5" /> {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const field = 'w-full rounded-xl border border-orange-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400';
const primary = 'rounded-xl bg-orange-500 px-4 py-2.5 font-semibold text-white hover:bg-orange-600 disabled:opacity-60';

function Status({ s }: { s: { ok: boolean; text: string } | null }) {
  if (!s) return null;
  return <p className={`mt-3 text-sm ${s.ok ? 'text-green-700' : 'text-red-600'}`}>{s.text}</p>;
}

export default function SettingsPage({ user, onUserChange, onSignedOut }: Props) {
  const [name, setName] = useState(user.name);
  const [alerts, setAlerts] = useState(user.stock_alerts);
  const [threshold, setThreshold] = useState(user.stock_alert_threshold);
  const [profileStatus, setProfileStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwStatus, setPwStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const [confirmEmail, setConfirmEmail] = useState('');
  const [delPw, setDelPw] = useState('');
  const [delStatus, setDelStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState('');

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('profile');
    try {
      const r = await accountAPI.updateProfile({ name, stock_alerts: alerts, stock_alert_threshold: threshold });
      onUserChange(r.data.user);
      setProfileStatus({ ok: true, text: 'Saved.' });
    } catch (err) {
      setProfileStatus({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy('');
    }
  };

  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('pw');
    try {
      await accountAPI.changePassword(user.has_password ? curPw : null, newPw);
      setCurPw('');
      setNewPw('');
      setPwStatus({ ok: true, text: 'Password updated. Other devices have been signed out.' });
      if (!user.has_password) onUserChange({ ...user, has_password: true });
    } catch (err) {
      setPwStatus({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy('');
    }
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

  const signOutEverywhere = async () => {
    await authAPI.logoutEverywhere();
    onSignedOut();
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

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-amber-950">Settings</h1>
        <p className="mt-1 text-stone-600">Manage your profile, alerts and security.</p>
      </div>

      <form onSubmit={saveProfile} className="space-y-6">
        <Card icon={UserIcon} title="Profile">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-stone-700">Name</span>
              <input className={field + ' mt-1'} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-stone-700">Email</span>
              <input className={field + ' mt-1 bg-stone-50 text-stone-500'} value={user.email} disabled />
            </label>
          </div>
          <p className="mt-3 text-sm text-stone-500">
            {user.email_verified ? '✓ Email verified' : 'Email not verified yet'} · {user.google_linked ? 'Google sign-in linked' : 'Email & password sign-in'}
          </p>
        </Card>

        <Card icon={Bell} title="Stock alerts">
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="font-medium text-stone-900">Daily email when my stocks move</span>
              <span className="block text-sm text-stone-500">Sent after market close on weekdays, only when something moved enough.</span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-orange-500" checked={alerts} onChange={(e) => setAlerts(e.target.checked)} />
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-medium text-stone-700">Alert when a stock moves at least <strong>{threshold}%</strong> in a day</span>
            <input type="range" min={0.5} max={15} step={0.5} value={threshold} disabled={!alerts}
              onChange={(e) => setThreshold(Number(e.target.value))} className="mt-2 w-full accent-orange-500" />
          </label>
          {!user.email_verified && <p className="mt-2 text-sm text-amber-700">Verify your email to receive alerts.</p>}
        </Card>

        <div>
          <button className={primary} disabled={busy === 'profile'}>Save changes</button>
          <Status s={profileStatus} />
        </div>
      </form>

      <Card icon={KeyRound} title={user.has_password ? 'Change password' : 'Add a password'}>
        <form onSubmit={changePw} className="space-y-3">
          {user.has_password && (
            <input className={field} type="password" placeholder="Current password" value={curPw}
              onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" required />
          )}
          <input className={field} type="password" placeholder="New password (10+ characters)" value={newPw}
            onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" required />
          <button className={primary} disabled={busy === 'pw'}>Update password</button>
          <Status s={pwStatus} />
        </form>
      </Card>

      <Card icon={ShieldAlert} title="Privacy & sessions">
        <div className="flex flex-wrap gap-3">
          <button onClick={exportData} className="inline-flex items-center gap-2 rounded-xl border border-orange-200 px-4 py-2.5 font-semibold text-orange-900 hover:bg-orange-50">
            <Download className="h-4 w-4" /> Download my data
          </button>
          <button onClick={signOutEverywhere} className="inline-flex items-center gap-2 rounded-xl border border-orange-200 px-4 py-2.5 font-semibold text-orange-900 hover:bg-orange-50">
            <LogOut className="h-4 w-4" /> Sign out of all devices
          </button>
        </div>
      </Card>

      <Card icon={Trash2} title="Delete account" danger>
        <form onSubmit={deleteAccount} className="space-y-3">
          <p className="text-sm text-stone-600">
            Permanently deletes your account, transactions, budgets, goals and stocks, and revokes all bank connections.
            This can't be undone.
          </p>
          <input className={field} placeholder={`Type ${user.email} to confirm`} value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)} required />
          {user.has_password && (
            <input className={field} type="password" placeholder="Password" value={delPw}
              onChange={(e) => setDelPw(e.target.value)} autoComplete="current-password" required />
          )}
          <button disabled={busy === 'delete' || confirmEmail.trim().toLowerCase() !== user.email}
            className="rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            Delete my account
          </button>
          <Status s={delStatus} />
        </form>
      </Card>
    </div>
  );
}
