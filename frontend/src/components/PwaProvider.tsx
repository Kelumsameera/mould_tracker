'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { I18N, type Lang } from '@/lib/i18n';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const PwaContext = createContext<{ prompt: InstallPrompt | null; installed: boolean; ios: boolean; clear: () => void }>({
  prompt: null, installed: false, ios: false, clear: () => {},
});

export default function PwaProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const update = () => setInstalled(standalone.matches || /ToolTrackerNative\//.test(navigator.userAgent) || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    update();
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const beforeInstall = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const appInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', appInstalled);
    standalone.addEventListener('change', update);
    if (window.isSecureContext && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', appInstalled);
      standalone.removeEventListener('change', update);
    };
  }, []);
  return <PwaContext.Provider value={{ prompt, installed, ios, clear: () => setPrompt(null) }}>{children}</PwaContext.Provider>;
}

export function PwaInstallButton({ lang, className = 'side-link' }: { lang: Lang; className?: string }) {
  const { prompt, installed, ios, clear } = useContext(PwaContext);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  if (installed) return null;
  async function install() {
    if (!prompt) { setHelp((value) => !value); return; }
    setBusy(true);
    try { await prompt.prompt(); await prompt.userChoice; }
    catch { setHelp(true); }
    finally { clear(); setBusy(false); }
  }
  const t = I18N[lang].install;
  return <>
    <button type="button" className={className} disabled={busy} onClick={install}>{t.button}</button>
    {help && <div className="pwa-install-help" role="status">
      <p>{ios ? t.ios : t.other}</p>
      <a className="pwa-help-link" href="/install.html">{t.guide}</a>
    </div>}
  </>;
}
