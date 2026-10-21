'use client';
import { useCallback, useEffect, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { api, ApiError } from '@/lib/api';
import { I18N, type Lang } from '@/lib/i18n';
import { errorText } from '@/lib/format';
import { can } from '@/lib/permissions';
import type { Mould, User } from '@/lib/types';
import { passkeyError } from '@/lib/passkeyText';
import LoginForm from '@/components/LoginForm';
import Sidebar, { type View } from '@/components/Sidebar';
import MouldSheet from '@/components/MouldSheet';
import MouldFormSheet from '@/components/MouldFormSheet';
import { AuditView, FindView, RackAdminView, RackView, WorkshopView } from '@/components/Views';
import { PasswordSheet, UsersSheet } from '@/components/AccountSheets';
import WorkReport from '@/components/WorkReport';
import PasskeySheet from '@/components/PasskeySheet';
import { Toaster } from 'react-hot-toast';
import { ConfirmHost } from '@/components/ConfirmHost';
import Icon, { type IconName } from '@/components/Icon';
import { ThemeToggle } from '@/components/ThemeProvider';
import { notify as feedback } from '@/lib/feedback';

const LANG_KEY = 'mould-tracker-lang';
const VIEWS: View[] = ['find', 'extrusion', 'racks', 'workshop', 'workReport', 'rackAdmin', 'audit'];

// Routes live in the hash: #/racks, #/find/m/<mouldId>. The back button closes a mould and QR links can open one.
function readRoute(): { view: View; mouldId: string | null } {
  const [, v, m, id] = window.location.hash.split('/');
  return { view: VIEWS.includes(v as View) ? (v as View) : 'find', mouldId: m === 'm' && id ? id : null };
}
const goTo = (view: View, mouldId: string | null = null) => { window.location.hash = `/${view}${mouldId ? `/m/${mouldId}` : ''}`; };

export default function Home() {
  const [lang, setLang] = useState<Lang>('en');
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [route, setRoute] = useState<{ view: View; mouldId: string | null }>({ view: 'find', mouldId: null });
  const [synced, setSynced] = useState<boolean | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [formFor, setFormFor] = useState<Mould | null | 'new'>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [passkeysOpen, setPasskeysOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const t = I18N[lang];

  useEffect(() => {
    try { const l = localStorage.getItem(LANG_KEY); if (l === 'en' || l === 'si') setLang(l); } catch { /* storage unavailable */ }
    const sync = () => setRoute(readRoute());
    sync();
    window.addEventListener('hashchange', sync);
    api.me().then((d) => setUser(d.user)).catch(() => {}).finally(() => setBooting(false));
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  // The signed-in user's saved language wins over this device's last choice.
  useEffect(() => { if (user?.language) setLang(user.language); }, [user?.language]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const changeLang = (l: Lang) => {
    setLang(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* storage unavailable */ }
    if (user && user.language !== l) api.setLanguage(l).then((d) => setUser(d.user)).catch(() => {});
  };

  async function login(email: string, password: string) {
    try { setLoginError(''); setUser((await api.login(email, password)).user); }
    catch (e) { setLoginError(errorText(e, t)); }
  }
  async function passkeyLogin() {
    try {
      setLoginError('');
      const { options } = await api.passkeyLoginOptions();
      setUser((await api.passkeyLoginVerify(await startAuthentication({ optionsJSON: options }))).user);
    } catch (e) { setLoginError(passkeyError(e, lang)); }
  }
  async function logout() {
    try { await api.logout(); } catch { /* signed out anyway */ }
    setUser(null); setAccountOpen(false); setPasskeysOpen(false); setUsersOpen(false); setFormFor(null);
  }

  const onSync = useCallback((ok: boolean) => setSynced(ok), []);
  const changed = useCallback(() => setRefreshKey((k) => k + 1), []);
  // Screens only report problems here; successes come from withToasts next to each action.
  const notify = useCallback((m: string) => { feedback.error(m); }, []);
  const openMould = useCallback((id: string) => goTo(route.view, id), [route.view]);
  const closeMould = () => goTo(route.view);

  // A 401 anywhere means the session ended.
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => api.me().catch((e) => { if (e instanceof ApiError && e.status === 401) setUser(null); }), 60_000);
    return () => clearInterval(id);
  }, [user]);

  if (booting) return <div className="boot">…</div>;
  if (!user) return <LoginForm lang={lang} onLang={changeLang} onLogin={login} onPasskey={passkeyLogin} error={loginError} />;

  const syncState = synced === null ? 'syncing' : synced ? 'synced' : 'offline';
  const titles: Record<View, string> = { find: t.brandTitle, extrusion: t.toolTypes.EXTRUSION_DIE, racks: t.racks.title, workshop: t.workshop.title, workReport: t.report.title, rackAdmin: t.rackAdmin.title, audit: t.audit.title };
  const view = route.view === 'audit' && !can(user, 'audit.view') ? 'find'
    : route.view === 'workReport' && !can(user, 'worklog.report') ? 'find'
    : route.view === 'rackAdmin' && !(can(user, 'racks.manage') || can(user, 'moulds.manage')) ? 'find' : route.view;

  return (
    <>
      <Sidebar open={navOpen} t={t} lang={lang} user={user} view={view} sync={syncState} syncText={t.sync[syncState]}
        onView={(v) => goTo(v)} onAccount={() => setAccountOpen(true)} onPasskeys={() => setPasskeysOpen(true)}
        onUsers={() => setUsersOpen(true)} onLogout={logout} onClose={() => setNavOpen(false)} />
      <div id="app">
        <header className="top-bar">
          <div className="top-title">
            <h1 className="brand-title">{titles[view]}</h1>
            <div className={'brand-sub sync ' + syncState}>{t.sync[syncState]}</div>
          </div>
          <div className="lang-toggle" role="group" aria-label={t.nav.language}>
            <button className={'lang-btn' + (lang === 'en' ? ' active' : '')} aria-pressed={lang === 'en'} onClick={() => changeLang('en')}>EN</button>
            <button className={'lang-btn' + (lang === 'si' ? ' active' : '')} aria-pressed={lang === 'si'} onClick={() => changeLang('si')} lang="si">සිං</button>
          </div>
          <ThemeToggle t={t} />
          <button className="icon-btn phone-only" onClick={() => setNavOpen(true)} aria-label={t.nav.accountMenu} title={t.nav.accountMenu}><Icon name="user" size={20} /></button>
        </header>

        {view === 'find' && <FindView t={t} lang={lang} onOpen={openMould} refreshKey={refreshKey} onSync={onSync} />}
        {view === 'extrusion' && <FindView key="extrusion" toolType="EXTRUSION_DIE" t={t} lang={lang} onOpen={openMould} refreshKey={refreshKey} onSync={onSync} />}
        {view === 'racks' && <RackView t={t} onOpen={openMould} refreshKey={refreshKey} toast={notify} />}
        {view === 'workshop' && <WorkshopView t={t} lang={lang} onOpen={openMould} refreshKey={refreshKey} toast={notify} />}
        {view === 'rackAdmin' && <RackAdminView t={t} canEdit={can(user, 'racks.manage')} toast={notify} />}
        {view === 'audit' && <AuditView t={t} lang={lang} toast={notify} />}
        {view === 'workReport' && <WorkReport t={t} lang={lang} userId={user.id} onOpen={openMould} toast={notify} />}

        {(view === 'find' || view === 'extrusion') && can(user, 'moulds.manage') && (
          <button className="fab-inner" onClick={() => setFormFor('new')} aria-label={view === 'extrusion' ? t.extrusionAdd : t.form.add} title={view === 'extrusion' ? t.extrusionAdd : t.form.add}><Icon name="add" size={26} /></button>
        )}
      </div>

      {/* Phone: main screens one thumb away; "More" opens the menu with admin screens and account. */}
      <nav className="bottom-nav" aria-label={t.nav.menu}>
        {([['find', t.nav.findShort, 'search'], ['extrusion', t.extrusionShort, 'mould'], ['racks', t.nav.racksShort, 'rack'], ['workshop', t.nav.workshopShort, 'workshop']] as [View, string, IconName][]).map(([v, label, icon]) => (
          <button key={v} className={view === v ? 'active' : ''} aria-current={view === v ? 'page' : undefined} onClick={() => goTo(v)}>
            <Icon name={icon} size={22} /><span>{label}</span>
          </button>
        ))}
        <button className={['workReport', 'rackAdmin', 'audit'].includes(view) ? 'active' : ''} onClick={() => setNavOpen(true)} aria-haspopup="dialog">
          <Icon name="more" size={22} /><span>{t.nav.more}</span>
        </button>
      </nav>

      <MouldSheet id={route.mouldId} user={user} t={t} lang={lang} refreshKey={refreshKey} onClose={closeMould} onChanged={changed} toast={notify}
        onEdit={(m) => setFormFor(m)} />
      {can(user, 'moulds.manage') && (
        <MouldFormSheet open={formFor !== null} mould={formFor === 'new' ? null : formFor} defaultToolType={view === 'extrusion' ? 'EXTRUSION_DIE' : 'INJECTION_MOULD'} t={t}
          onClose={() => setFormFor(null)}
          onSaved={(m, close) => { changed(); if (close) { setFormFor(null); goTo(view, m.id); } }} />
      )}
      <PasskeySheet open={passkeysOpen} lang={lang} onClose={() => setPasskeysOpen(false)} />
      <PasswordSheet user={user} onUpdated={setUser} open={accountOpen} t={t} onClose={() => setAccountOpen(false)} onDone={() => setAccountOpen(false)} onError={notify} />
      {can(user, 'users.manage') && <UsersSheet me={user} onUpdated={setUser} open={usersOpen} t={t} onClose={() => setUsersOpen(false)} onError={notify} />}
      <ConfirmHost t={t} />
      <Toaster position="bottom-center" containerClassName="toaster" toastOptions={{ className: 'toast-hot', duration: 3500, error: { duration: 6000 } }} />
    </>
  );
}
