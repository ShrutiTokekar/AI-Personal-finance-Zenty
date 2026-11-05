import { useEffect, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { accountAPI, errorMessage, type User } from '../../services/api';

type Status = { ok: boolean; text: string } | null;
type Stage = 'idle' | 'scan' | 'codes';

const field = 'input';

/** Free two-step sign-in with any authenticator app (TOTP), plus backup codes. */
export default function AuthenticatorCard({ user, onUserChange }: { user: User; onUserChange: (u: User) => void }) {
  const [stage, setStage] = useState<Stage>('idle');
  const [password, setPassword] = useState('');
  const [secret, setSecret] = useState('');
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  // QR code is drawn in the browser, so the secret never goes to any outside service.
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: '#1f2b18', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [url]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setStatus(null);
    try {
      await fn();
    } catch (err) {
      setStatus({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const start = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await accountAPI.totpSetup(user.has_password ? password : null);
      setSecret(r.data.secret);
      setUrl(r.data.otpauth_url);
      setPassword('');
      setCode('');
      setStage('scan');
    });
  };

  const enable = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await accountAPI.totpEnable(code);
      onUserChange(r.data.user);
      setCodes(r.data.backup_codes);
      setSecret('');
      setUrl('');
      setQr('');
      setStage('codes');
    });
  };

  const disable = () => {
    if (user.has_password && !password) {
      setStatus({ ok: false, text: 'Enter your current password to turn this off.' });
      return;
    }
    if (!window.confirm('Turn off two-step sign-in? Your account will be protected by your password only.')) return;
    run(async () => {
      const r = await accountAPI.totpDisable(user.has_password ? password : null);
      onUserChange(r.data.user);
      setPassword('');
      setStatus({ ok: true, text: 'Two-step sign-in is off.' });
    });
  };

  const regenerate = () => {
    if (user.has_password && !password) {
      setStatus({ ok: false, text: 'Enter your current password to make new backup codes.' });
      return;
    }
    run(async () => {
      const r = await accountAPI.newBackupCodes(user.has_password ? password : null);
      onUserChange(r.data.user);
      setCodes(r.data.backup_codes);
      setPassword('');
      setStage('codes');
    });
  };

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatus({ ok: false, text: "Couldn't copy. Select the codes and copy them manually." });
    }
  };

  const downloadCodes = () => {
    const text = `Zenty backup codes for ${user.email}\nEach code works once. Keep them somewhere safe.\n\n${codes.join('\n')}\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'zenty-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mt-4 rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100"><Smartphone className="h-5 w-5 text-gray-600" /></span>
          <div>
            <p className="font-medium text-ink">Two-step sign-in with an authenticator app</p>
            <p className="text-sm text-gray-500">Free. After your password, enter a 6-digit code from an app on your phone.</p>
          </div>
        </div>
        {user.totp_enabled && stage !== 'codes' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700"><ShieldCheck className="h-3.5 w-3.5" /> On</span>
        )}
      </div>

      {/* Off: start setup */}
      {!user.totp_enabled && stage === 'idle' && (
        <form onSubmit={start} className="mt-4 space-y-3">
          <p className="text-sm text-gray-600">
            Works with Apple Passwords, Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden and other authenticator apps.
          </p>
          <div className="flex flex-wrap gap-2">
            {user.has_password && (
              <input className={`${field} max-w-xs`} type="password" autoComplete="current-password" placeholder="Current password"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
            )}
            <button className="btn-primary" disabled={busy}>Set up</button>
          </div>
        </form>
      )}

      {/* Scan the QR code */}
      {stage === 'scan' && (
        <form onSubmit={enable} className="mt-4 grid gap-5 sm:grid-cols-[220px_1fr]">
          <div className="flex h-[220px] w-[220px] items-center justify-center rounded-2xl border border-line bg-white">
            {qr ? <img src={qr} alt="QR code to add Zenty to your authenticator app" className="h-[200px] w-[200px]" /> : <span className="text-xs text-gray-400">Loading…</span>}
          </div>
          <div className="space-y-3 text-sm">
            <ol className="list-decimal space-y-1.5 pl-5 text-gray-700">
              <li>Open your authenticator app and add a new account.</li>
              <li>Scan this QR code. Can't scan? Enter this key instead:</li>
            </ol>
            <p className="num select-all break-all rounded-xl bg-gray-50 px-3 py-2 font-mono text-[13px] tracking-wider text-ink">{secret.match(/.{1,4}/g)?.join(' ')}</p>
            <p className="text-gray-700">3. Type the 6-digit code the app shows for Zenty:</p>
            <div className="flex flex-wrap gap-2">
              <input className={`${field} num max-w-[160px] text-center tracking-[0.35em]`} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-label="6-digit code" autoFocus />
              <button className="btn-primary" disabled={busy || code.length !== 6}>Turn on</button>
              <button type="button" className="btn-ghost" onClick={() => { setStage('idle'); setSecret(''); setUrl(''); setQr(''); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      {/* Show backup codes once */}
      {stage === 'codes' && (
        <div className="mt-4 rounded-2xl border border-saffron-200 bg-saffron-50 p-4">
          <p className="flex items-center gap-2 font-semibold text-ink"><KeyRound className="h-4 w-4 text-saffron-600" /> Save your backup codes</p>
          <p className="mt-1 text-sm text-gray-700">
            If you lose your phone, each code lets you sign in once. This is the only time they'll be shown. Store them in your password manager.
          </p>
          <ul className="num mt-3 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5">
            {codes.map((c) => <li key={c} className="rounded-lg bg-white px-2 py-1.5 text-center text-ink">{c}</li>)}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={copyCodes} className="btn-ghost">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}</button>
            <button type="button" onClick={downloadCodes} className="btn-ghost"><Download className="h-4 w-4" /> Download</button>
            <button type="button" onClick={() => { setCodes([]); setStage('idle'); setStatus({ ok: true, text: 'Two-step sign-in is on.' }); }} className="btn-primary">I've saved them</button>
          </div>
        </div>
      )}

      {/* On: manage */}
      {user.totp_enabled && stage === 'idle' && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-gray-600">
            {user.backup_codes_left ?? 0} backup code{user.backup_codes_left === 1 ? '' : 's'} left. If you lose your phone, you can also get a sign-in code by email.
          </p>
          <div className="flex flex-wrap gap-2">
            {user.has_password && (
              <input className={`${field} max-w-xs`} type="password" autoComplete="current-password" placeholder="Current password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
            <button type="button" onClick={regenerate} disabled={busy} className="btn-ghost">New backup codes</button>
            <button type="button" onClick={disable} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">Turn off</button>
          </div>
        </div>
      )}

      {status && <p role="status" className={`mt-3 text-sm ${status.ok ? 'text-primary-700' : 'text-red-600'}`}>{status.text}</p>}
    </div>
  );
}
