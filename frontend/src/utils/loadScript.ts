const loaded: Record<string, Promise<void>> = {};

/** Load a third-party script once (Google Identity Services, Plaid Link). */
export function loadScript(src: string): Promise<void> {
  if (!loaded[src]) {
    loaded[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        delete loaded[src];
        reject(new Error(`Failed to load ${src}`));
      };
      document.head.appendChild(s);
    });
  }
  return loaded[src];
}
