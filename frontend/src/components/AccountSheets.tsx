'use client';
import { useCallback, useEffect, useState } from 'react';
import Sheet from './Sheet';
import { api } from '@/lib/api';
import type { Dict } from '@/lib/i18n';
import { errorText } from '@/lib/format';
import { assignableRoles } from '@/lib/permissions';
import type { Role, User } from '@/lib/types';

export function PasswordSheet({ open, t, user, onUpdated, onClose, onDone, onError }: {
  open: boolean; t: Dict; user: User; onUpdated: (user: User) => void;
  onClose: () => void; onDone: (m: string) => void; onError: (m: string) => void;
}) {
  const [name, setName] = useState(user.name); const [email, setEmail] = useState(user.email);
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(user.name); setEmail(user.email); setCur(''); setNext(''); setAgain('');
  }, [open, user.name, user.email]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (next !== again) return onError(t.pwMismatch);
    setBusy(true);
    try {
      const result = await api.updateProfile({ name, email, currentPassword: cur, ...(next ? { newPassword: next } : {}) });
      onUpdated(result.user);
      setCur(''); setNext(''); setAgain('');
      onDone(t.accountSaved);
    } catch (e) { onError(errorText(e, t)); }
    finally { setBusy(false); }
  }
  return (
    <Sheet open={open} onClose={onClose} label={t.accountTitle}>
      <h2 className="detail-name form-title">{t.accountTitle}</h2>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="plain">
          <label className="field-label" htmlFor="account-name">{t.name}</label>
          <input id="account-name" className="field-input" autoComplete="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          <label className="field-label" htmlFor="account-email">{t.email}</label>
          <input id="account-email" className="field-input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="field-label" htmlFor="account-current">{t.currentPassword}</label>
          <input id="account-current" className="field-input" type="password" autoComplete="current-password" required maxLength={128} value={cur} onChange={(e) => setCur(e.target.value)} />
          <p className="passkey-note">{t.keepPassword}</p>
          <label className="field-label" htmlFor="account-new">{t.newPassword}</label>
          <input id="account-new" className="field-input" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={next} onChange={(e) => setNext(e.target.value)} />
          <label className="field-label" htmlFor="account-repeat">{t.repeatPassword}</label>
          <input id="account-repeat" className="field-input" type="password" autoComplete="new-password" required={!!next} maxLength={128} value={again} onChange={(e) => setAgain(e.target.value)} />
          <button className="btn btn-primary" type="submit">{busy ? '…' : t.saveBtn}</button>
        </fieldset>
      </form>
    </Sheet>
  );
}

export function UsersSheet({ open, t, me, onUpdated, onClose, onError, onDone }: {
  open: boolean; t: Dict; me: User; onUpdated: (user: User) => void; onClose: () => void; onError: (m: string) => void; onDone: (m: string) => void;
}) {
  const [editing, setEditing] = useState<User | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'mould_technician' as Role });
  const roles = assignableRoles(me);
  // Admins cannot change Super Admin accounts (the server refuses too).
  const locked = (u: User) => u.id === me.id || (u.role === 'super_admin' && me.role !== 'super_admin');
  const roleOptions = (current?: Role) => [...new Set([...(current ? [current] : []), ...roles])].map((r) => <option key={r} value={r}>{t.roles[r]}</option>);

  useEffect(() => { setEditing(null); setEditPassword(''); }, [open]);
  const load = useCallback(() => api.users().then((d) => setUsers(d.users)).catch((e) => onError(errorText(e, t))), [onError, t]);
  useEffect(() => { if (open) load(); }, [open, load]);

  async function run(work: () => Promise<unknown>, done: string) {
    setSaving(true);
    try { await work(); onDone(done); await load(); return true; } catch (e) { onError(errorText(e, t)); return false; } finally { setSaving(false); }
  }
  async function saveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || saving) return;
    const ok = await run(async () => {
      const { user } = await api.updateUser(editing.id, { name: editing.name, email: editing.email, ...(editPassword ? { password: editPassword } : {}) });
      if (user.id === me.id) onUpdated(user);
    }, t.userSaved);
    if (ok) { setEditing(null); setEditPassword(''); }
  }

  return (
    <Sheet open={open} onClose={onClose} label={t.users}>
      <h2 className="detail-name form-title">{t.users}</h2>
      <p className="passkey-note">{t.rolesHelp}</p>
      {editing && <form onSubmit={saveUser}>
        <h3 className="sub-title">{editing.email}</h3>
        <label className="field-label" htmlFor="edit-user-name">{t.name}</label>
        <input id="edit-user-name" className="field-input" required maxLength={120} disabled={saving} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
        <label className="field-label" htmlFor="edit-user-email">{t.email}</label>
        <input id="edit-user-email" className="field-input" type="email" required disabled={saving} value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
        <label className="field-label" htmlFor="edit-user-password">{t.newPassword}</label>
        <input id="edit-user-password" className="field-input" type="password" autoComplete="new-password" minLength={8} maxLength={128} disabled={saving} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
        <button className="btn btn-primary" disabled={saving}>{t.saveBtn}</button>
        <button className="link-btn" type="button" disabled={saving} onClick={() => { setEditing(null); setEditPassword(''); }}>{t.cancel}</button>
      </form>}
      <div className="user-list">
        {users.map((u) => (
          <div className={'user-row' + (u.active ? '' : ' off')} key={u.id}>
            <div className="user-main"><b>{u.name}</b><small>{u.email}</small>
              <span>
                <button className="link-btn" disabled={saving || (locked(u) && u.id !== me.id)} onClick={() => { setEditing(u); setEditPassword(''); }}>{t.editUser}</button>
                {!locked(u) && <button className="link-btn danger" disabled={saving} onClick={() => { if (confirm(t.confirmDeleteUser(u.name))) run(() => api.deleteUser(u.id), t.userDeleted); }}>{t.deleteUser}</button>}
              </span>
            </div>
            <select aria-label={t.role} value={u.role} disabled={saving || locked(u)} onChange={(e) => run(() => api.updateUser(u.id, { role: e.target.value as Role }), t.userSaved)}>
              {roleOptions(u.role)}
            </select>
            <button className="link-btn" disabled={saving || locked(u)} onClick={() => run(() => api.updateUser(u.id, { active: !u.active }), t.userSaved)}>{u.active ? t.active : t.disabled}</button>
          </div>
        ))}
      </div>
      <h3 className="sub-title">{t.addUser}</h3>
      <input className="field-input" placeholder={t.name} aria-label={t.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input className="field-input mt" type="email" placeholder={t.email} aria-label={t.email} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input className="field-input mt" type="password" autoComplete="new-password" placeholder={t.newPassword} aria-label={t.newPassword} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <select className="field-input mt" aria-label={t.role} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
        {roleOptions()}
      </select>
      <button className="btn btn-primary" disabled={saving} onClick={async () => { if (await run(() => api.createUser(form), t.userAdded)) setForm({ name: '', email: '', password: '', role: 'mould_technician' }); }}>{t.addUser}</button>
    </Sheet>
  );
}
