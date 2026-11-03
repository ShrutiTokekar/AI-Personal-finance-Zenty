import { useEffect, useRef, useState } from 'react';
import { loadScript } from '../../utils/loadScript';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

interface Props {
  clientId: string;
  onCredential: (credential: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

/** Official "Sign in with Google" button. Google returns a signed ID token that
 *  our server verifies; we never see the user's Google password. */
export default function GoogleButton({ clientId, onCredential, text = 'continue_with' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    cb.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let cancelled = false;
    loadScript('https://accounts.google.com/gsi/client')
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => cb.current(r.credential),
        });
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          width: Math.min(ref.current.offsetWidth || 360, 400),
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [clientId, text]);

  if (failed) {
    return <p className="text-sm text-stone-500 text-center">Google sign-in is unavailable right now.</p>;
  }
  return <div ref={ref} className="w-full flex justify-center min-h-[44px]" />;
}
