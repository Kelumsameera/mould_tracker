'use client';
import { useState, type FormEvent } from 'react';
import { I18N, type Lang } from '@/lib/i18n';

export default function LoginForm({ lang, onLang, onLogin, error }: {
  lang: Lang; onLang: (l: Lang) => void; onLogin: (email: string, password: string) => Promise<void>; error: string;
}) {
  const t = I18N[lang];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onLogin(email, password);
    setBusy(false);
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <div className="lang-toggle dark">
          <button type="button" className={'lang-btn' + (lang === 'en' ? ' active' : '')} onClick={() => onLang('en')}>EN</button>
          <button type="button" className={'lang-btn' + (lang === 'si' ? ' active' : '')} onClick={() => onLang('si')}>සිං</button>
        </div>
        <h1>{t.brandTitle}</h1>
        <p>{t.loginSub}</p>
        <label className="field-label">{t.email}</label>
        <input className="field-input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="field-label">{t.password}</label>
        <input className="field-input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn btn-primary" disabled={busy}>{busy ? t.signingIn : t.signIn}</button>
      </form>
    </div>
  );
}
