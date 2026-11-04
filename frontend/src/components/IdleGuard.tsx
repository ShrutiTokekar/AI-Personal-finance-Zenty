import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { authAPI } from '../services/api';

const WARN_SECONDS = 120;
const PING_EVERY_MS = 4 * 60 * 1000; // keep the server session fresh while you're active
const STORAGE_KEY = 'zenty:lastActivity';
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;

function readShared(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}
function writeShared(t: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(t));
  } catch {
    /* storage unavailable: this tab still tracks its own activity */
  }
}

/**
 * Signs the user out after `minutes` without activity, with a two-minute warning.
 * Activity in any open Zenty tab counts. The server enforces the same limit, so a
 * closed laptop or stolen cookie can't keep a session alive.
 */
export default function IdleGuard({ minutes, onTimeout }: { minutes: number; onTimeout: () => void }) {
  const lastActivity = useRef(0);
  const lastPing = useRef(0);
  const warningRef = useRef(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  const markActive = useCallback((force = false) => {
    if (warningRef.current && !force) return; // once warned, require an explicit choice
    const now = Date.now();
    if (now - lastActivity.current < 1000 && !force) return;
    lastActivity.current = now;
    writeShared(now);
    if (now - lastPing.current > PING_EVERY_MS || force) {
      lastPing.current = now;
      authAPI.me().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const start = Date.now();
    lastActivity.current = start;
    lastPing.current = start;
    writeShared(start);
    const onEvent = () => markActive();
    EVENTS.forEach((e) => window.addEventListener(e, onEvent, { passive: true }));
    const tick = setInterval(() => {
      const last = Math.max(lastActivity.current, readShared());
      lastActivity.current = last;
      const left = Math.round(minutes * 60 - (Date.now() - last) / 1000);
      if (left <= 0) {
        clearInterval(tick);
        onTimeout();
        return;
      }
      warningRef.current = left <= WARN_SECONDS;
      setRemaining(left <= WARN_SECONDS ? left : null);
    }, 1000);
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, onEvent));
      clearInterval(tick);
    };
  }, [minutes, onTimeout, markActive]);

  if (remaining === null) return null;
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-lift">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-saffron-50"><ShieldAlert className="h-6 w-6 text-saffron-600" /></span>
        <h2 id="idle-title" className="mt-4 font-display text-2xl font-semibold text-ink">Still there?</h2>
        <p className="mt-2 text-sm text-gray-600">For your security, Zenty will sign you out in</p>
        <p className="num mt-2 font-display text-4xl font-semibold text-ink" aria-live="polite">{mm}:{ss}</p>
        <div className="mt-6 grid gap-2">
          <button autoFocus onClick={() => { warningRef.current = false; markActive(true); setRemaining(null); }} className="btn-primary w-full">Stay signed in</button>
          <button onClick={onTimeout} className="btn-ghost w-full">Sign out now</button>
        </div>
      </div>
    </div>
  );
}
