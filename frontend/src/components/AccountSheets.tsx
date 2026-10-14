'use client';
import { useCallback, useEffect, useState } from 'react';
import Sheet from './Sheet';
import { api } from '@/lib/api';
import { I18N, type Lang } from '@/lib/i18n';
import type { Role, User } from '@/lib/types';

export function PasswordSheet({ open, lang, onClose, onDone, onError }: {
  open: boolean; lang: Lang; onClose: () => void; onDone: (m: string) => void; onError: (m: string) => void;
}) {
  const t = I18N[lang];
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [again, setAgain] = useState('');

  async function submit() {
    if (next !== again) return onError(t.pwMismatch);
    try {
      await api.changePassword(cur, next);
      setCur(''); setNext(''); setAgain('');
      onDone(t.pwChanged);
    } catch (e) { onError((e as Error).message); }
  }

  return (
    <Sheet open={open} onClose={onClose} label={t.changePassword}>
      <h2 className="detail-name form-title">{t.changePassword}</h2>
      <label className="field-label">{t.currentPassword}</label>
      <input className="field-input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
      <label className="field-label">{t.newPassword}</label>
      <input className="field-input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      <label className="field-label">{t.repeatPassword}</label>
      <input className="field-input" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      <button className="btn btn-primary" onClick={submit}>{t.changePassword}</button>
    </Sheet>
  );
}

export function UsersSheet({ open, lang, meId, onClose, onError, onDone }: {
  open: boolean; lang: Lang; meId: string; onClose: () => void; onError: (m: string) => void; onDone: (m: string) => void;
}) {
  const t = I18N[lang];
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'operator' as Role });

  const load = useCallback(() => api.users().then((d) => setUsers(d.users)).catch((e: Error) => onError(e.message)), [onError]);
  useEffect(() => { if (open) load(); }, [open, load]);

  async function add() {
    try {
      await api.createUser(form);
      setForm({ name: '', email: '', password: '', role: 'operator' });
      onDone(t.addUser);
      load();
    } catch (e) { onError((e as Error).message); }
  }
  async function patch(id: string, p: { role?: Role; active?: boolean }) {
    try { await api.updateUser(id, p); load(); } catch (e) { onError((e as Error).message); }
  }

  return (
    <Sheet open={open} onClose={onClose} label={t.users}>
      <h2 className="detail-name form-title">{t.users}</h2>
      <div className="user-list">
        {users.map((u) => (
          <div className={'user-row' + (u.active ? '' : ' off')} key={u.id}>
            <div className="user-main"><b>{u.name}</b><small>{u.email}</small></div>
            <select aria-label={t.role} value={u.role} disabled={u.id === meId} onChange={(e) => patch(u.id, { role: e.target.value as Role })}>
              <option value="admin">admin</option><option value="operator">operator</option><option value="viewer">viewer</option>
            </select>
            <button className="link-btn" disabled={u.id === meId} onClick={() => patch(u.id, { active: !u.active })}>{u.active ? t.active : t.disabled}</button>
          </div>
        ))}
      </div>
      <h3 className="sub-title">{t.addUser}</h3>
      <input className="field-input" placeholder={t.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input className="field-input mt" type="email" placeholder={t.email} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input className="field-input mt" type="password" autoComplete="new-password" placeholder={t.newPassword} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <select className="field-input mt" aria-label={t.role} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
        <option value="operator">operator</option><option value="viewer">viewer</option><option value="admin">admin</option>
      </select>
      <button className="btn btn-primary" onClick={add}>{t.addUser}</button>
    </Sheet>
  );
}
