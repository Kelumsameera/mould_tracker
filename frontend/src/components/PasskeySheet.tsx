'use client';
import { useEffect, useState } from 'react';
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import { api, type PasskeyInfo } from '@/lib/api';
import { passkeyText, passkeyError } from '@/lib/passkeyText';
import { I18N, type Lang } from '@/lib/i18n';
import Sheet from './Sheet';

export default function PasskeySheet({ open, lang, onClose }: { open: boolean; lang: Lang; onClose: () => void }) {
  const p = passkeyText(lang);
  const [keys, setKeys] = useState<PasskeyInfo[]>([]);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setPassword(''); setName(''); setMessage(''); setError(''); setAvailable(false);
    if (!open) return;
    let cancelled = false;
    api.passkeys().then((d) => { if (!cancelled) setKeys(d.passkeys); }).catch((e: Error) => { if (!cancelled) setError(e.message); });
    if (window.isSecureContext && browserSupportsWebAuthn()) api.passkeyCapabilities().then((d) => { if (!cancelled) setAvailable(d.enabled); }).catch(() => {});
    return () => { cancelled = true; };
  }, [open]);

  async function add() {
    setBusy(true); setMessage(''); setError('');
    try {
      const { options } = await api.passkeyRegistrationOptions(password, name.trim());
      const response = await startRegistration({ optionsJSON: options });
      await api.passkeyRegistrationVerify(response);
      setKeys((await api.passkeys()).passkeys); setPassword(''); setName(''); setMessage(p.added);
    } catch (e) { setError(passkeyError(e, lang)); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setMessage(''); setError('');
    try {
      await api.removePasskey(id, password); setKeys((list) => list.filter((key) => key.id !== id)); setPassword(''); setMessage(p.removed);
    } catch (e) { setError(passkeyError(e, lang)); }
    finally { setBusy(false); }
  }

  return <Sheet open={open} onClose={busy ? () => {} : onClose} label={p.title} closeLabel={I18N[lang].close}>
    <h2 className="detail-name form-title">{p.title}</h2>
    <p>{p.description}</p>
    {!available && <p className="passkey-note">{p.https}</p>}
    <label className="field-label" htmlFor="passkey-password">{p.password}</label>
    <input id="passkey-password" className="field-input" type="password" autoComplete="current-password" disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} />
    <label className="field-label" htmlFor="passkey-name">{p.name}</label>
    <input id="passkey-name" className="field-input" maxLength={80} placeholder="My phone / Windows Hello" disabled={busy} value={name} onChange={(e) => setName(e.target.value)} />
    <button className="btn btn-primary" disabled={busy || !available || !password || !name.trim()} onClick={add}>{p.add}</button>
    {message && <p role="status">{message}</p>}
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="user-list">
      {!keys.length && <p>{p.empty}</p>}
      {keys.map((key) => <div className="user-row" key={key.id}>
        <div className="user-main"><b>{key.name}</b><small>{new Date(key.createdAt).toLocaleDateString()}</small></div>
        <button className="link-btn" disabled={busy || !available || !password} onClick={() => remove(key.id)}>{p.remove}</button>
      </div>)}
    </div>
  </Sheet>;
}
