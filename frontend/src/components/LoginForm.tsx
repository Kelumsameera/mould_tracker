'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { I18N, type Lang } from '@/lib/i18n';
import { api } from '@/lib/api';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { passkeyText } from '@/lib/passkeyText';
import { PwaInstallButton } from './PwaProvider';
import { ThemeToggle } from './ThemeProvider';

export default function LoginForm({ lang, onLang, onLogin, onPasskey, error }: {
  lang: Lang; onLang: (l: Lang) => void; onLogin: (email: string, password: string) => Promise<void>; onPasskey: () => Promise<void>; error: string;
}) {
  const t = I18N[lang];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const p = passkeyText(lang);
  useEffect(() => {
    if (window.isSecureContext && browserSupportsWebAuthn()) api.passkeyCapabilities().then((d) => setPasskeyAvailable(d.enabled)).catch(() => {});
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await onLogin(email, password); } finally { setBusy(false); }
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <div className="login-controls"><ThemeToggle t={t} /><div className="lang-toggle dark">
          <button type="button" className={'lang-btn' + (lang === 'en' ? ' active' : '')} onClick={() => onLang('en')}>EN</button>
          <button type="button" className={'lang-btn' + (lang === 'si' ? ' active' : '')} onClick={() => onLang('si')}>සිං</button>
        </div></div>
        <h1>{t.brandTitle}</h1>
        <p>{t.loginSub}</p>
        <label className="field-label">{t.email}</label>
        <input className="field-input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="field-label">{t.password}</label>
        <input className="field-input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn btn-primary" disabled={busy}>{busy ? t.signingIn : t.signIn}</button>
        <button type="button" className="btn btn-secondary mt" disabled={busy || !passkeyAvailable} onClick={async () => {
          setBusy(true);
          try { await onPasskey(); } finally { setBusy(false); }
        }}>{p.login}</button>
        <p className="passkey-note">{passkeyAvailable ? p.description : p.https}</p>
        <PwaInstallButton lang={lang} className="btn btn-secondary mt" />
      </form>
    </div>
  );
}
