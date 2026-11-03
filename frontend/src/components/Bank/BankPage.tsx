import { useCallback, useEffect, useState } from 'react';
import { Building2, CreditCard, Landmark, Loader2, Lock, Plus, RefreshCw, ShieldCheck, Trash2, Wallet } from 'lucide-react';
import { bankAPI, type BankItem, errorMessage, type User } from '../../services/api';
import { loadScript } from '../../utils/loadScript';

declare global {
  interface Window {
    Plaid?: {
      create: (opts: {
        token: string;
        onSuccess: (publicToken: string, metadata: unknown) => void;
        onExit?: (err: unknown) => void;
      }) => { open: () => void; destroy: () => void };
    };
  }
}

const money = (n: number | null | undefined, cur = 'USD') =>
  n == null ? '—' : n.toLocaleString(undefined, { style: 'currency', currency: cur });

function AccountIcon({ type }: { type: string }) {
  if (type === 'credit') return <CreditCard className="h-5 w-5 text-orange-600" />;
  if (type === 'loan') return <Landmark className="h-5 w-5 text-orange-600" />;
  return <Wallet className="h-5 w-5 text-orange-600" />;
}

export default function BankPage({ user, enabled, onRequestVerify }: { user: User; enabled: boolean; onRequestVerify: () => void }) {
  const [items, setItems] = useState<BankItem[]>([]);
  const [totals, setTotals] = useState({ assets: 0, debt: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'' | 'link' | 'sync'>('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!user.email_verified || !enabled) {
      setLoading(false);
      return;
    }
    try {
      const r = await bankAPI.accounts();
      setItems(r.data.items);
      setTotals({ assets: r.data.total_assets, debt: r.data.total_debt });
    } catch (e) {
      setMsg({ kind: 'error', text: errorMessage(e) });
    } finally {
      setLoading(false);
    }
  }, [user.email_verified, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const link = async () => {
    setMsg(null);
    setBusy('link');
    try {
      const [{ data }] = await Promise.all([
        bankAPI.linkToken(),
        loadScript('https://cdn.plaid.com/link/v2/stable/link-initialize.js'),
      ]);
      if (!window.Plaid) throw new Error('Plaid failed to load');
      const handler = window.Plaid.create({
        token: data.link_token,
        onSuccess: async (publicToken) => {
          setBusy('link');
          try {
            const r = await bankAPI.exchange(publicToken);
            setMsg({ kind: 'ok', text: `${r.data.institution} connected. Imported ${r.data.imported} transactions.` });
            await load();
          } catch (e) {
            setMsg({ kind: 'error', text: errorMessage(e) });
          } finally {
            setBusy('');
            handler.destroy();
          }
        },
        onExit: () => {
          setBusy('');
          handler.destroy();
        },
      });
      handler.open();
    } catch (e) {
      setMsg({ kind: 'error', text: errorMessage(e, 'Could not start bank linking.') });
      setBusy('');
    }
  };

  const sync = async () => {
    setBusy('sync');
    setMsg(null);
    try {
      const r = await bankAPI.sync();
      setMsg(r.data.errors.length
        ? { kind: 'error', text: r.data.errors.map((e) => `${e.institution}: ${e.error}`).join(' ') }
        : { kind: 'ok', text: `Up to date. ${r.data.imported} new transactions.` });
      await load();
    } catch (e) {
      setMsg({ kind: 'error', text: errorMessage(e) });
    } finally {
      setBusy('');
    }
  };

  const unlink = async (item: BankItem) => {
    if (!window.confirm(`Disconnect ${item.institution}? Zenty will revoke its access immediately.`)) return;
    try {
      await bankAPI.unlink(item.id);
      setMsg({ kind: 'ok', text: `${item.institution} disconnected and access revoked.` });
      await load();
    } catch (e) {
      setMsg({ kind: 'error', text: errorMessage(e) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-amber-950">Bank accounts</h1>
          <p className="mt-1 text-stone-600">Balances and transactions from your linked banks.</p>
        </div>
        {user.email_verified && enabled && (
          <div className="flex gap-2">
            {items.length > 0 && (
              <button onClick={sync} disabled={!!busy}
                className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-2.5 font-semibold text-orange-900 hover:bg-orange-50 disabled:opacity-60">
                <RefreshCw className={`h-4 w-4 ${busy === 'sync' ? 'animate-spin' : ''}`} /> Sync
              </button>
            )}
            <button onClick={link} disabled={!!busy}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-4 py-2.5 font-semibold text-white shadow hover:from-orange-600 hover:to-amber-700 disabled:opacity-60">
              {busy === 'link' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Link a bank
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-green-200 bg-green-50 p-4 flex gap-3">
        <ShieldCheck className="h-6 w-6 shrink-0 text-green-700" />
        <div className="text-sm text-green-900">
          <p className="font-semibold">How we keep your bank safe</p>
          <p className="mt-1">
            You sign in to your bank inside Plaid's secure window. Zenty never sees or stores your bank username or password.
            The access key Plaid gives us is encrypted on our server and never sent to your browser. We only keep account
            names, the last 4 digits and balances. You can disconnect at any time.
          </p>
        </div>
      </div>

      {msg && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm border ${msg.kind === 'ok'
          ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>{msg.text}</p>
      )}

      {!enabled ? (
        <div className="rounded-2xl bg-white border border-orange-100 p-8 text-center">
          <Building2 className="mx-auto h-10 w-10 text-orange-300" />
          <p className="mt-3 font-semibold text-amber-950">Bank linking isn't switched on yet</p>
          <p className="mt-1 text-sm text-stone-600">The site owner needs to add Plaid keys on the server.</p>
        </div>
      ) : !user.email_verified ? (
        <div className="rounded-2xl bg-white border border-orange-100 p-8 text-center">
          <Lock className="mx-auto h-10 w-10 text-orange-300" />
          <p className="mt-3 font-semibold text-amber-950">Verify your email to link a bank</p>
          <p className="mt-1 text-sm text-stone-600">This extra step makes sure only you can connect accounts to your Zenty.</p>
          <button onClick={onRequestVerify} className="mt-4 rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600">
            Resend verification email
          </button>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-white border border-orange-100 p-10 text-center">
          <Building2 className="mx-auto h-12 w-12 text-orange-300" />
          <p className="mt-3 text-lg font-semibold text-amber-950">No banks linked yet</p>
          <p className="mt-1 text-stone-600">Link checking, savings or credit cards to import transactions automatically.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-white border border-orange-100 p-5">
              <p className="text-sm text-stone-500">Cash & investments</p>
              <p className="mt-1 text-2xl font-bold text-green-700">{money(totals.assets)}</p>
            </div>
            <div className="rounded-2xl bg-white border border-orange-100 p-5">
              <p className="text-sm text-stone-500">Credit & loans</p>
              <p className="mt-1 text-2xl font-bold text-red-700">{money(totals.debt)}</p>
            </div>
          </div>
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl bg-white border border-orange-100 overflow-hidden">
              <div className="flex items-center justify-between bg-orange-50 px-5 py-3">
                <div>
                  <p className="font-bold text-amber-950">{item.institution}</p>
                  <p className="text-xs text-stone-500">
                    {item.last_synced ? `Synced ${new Date(item.last_synced + 'Z').toLocaleString()}` : 'Not synced yet'}
                  </p>
                </div>
                <button onClick={() => unlink(item)} className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800">
                  <Trash2 className="h-4 w-4" /> Disconnect
                </button>
              </div>
              <ul className="divide-y divide-orange-50">
                {item.accounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <AccountIcon type={a.type} />
                      <div>
                        <p className="font-medium text-stone-900">{a.name}</p>
                        <p className="text-xs text-stone-500 capitalize">{a.subtype || a.type}{a.mask ? ` •••• ${a.mask}` : ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-stone-900">{money(a.current_balance, a.currency)}</p>
                      {a.available_balance != null && a.available_balance !== a.current_balance && (
                        <p className="text-xs text-stone-500">{money(a.available_balance, a.currency)} available</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
