'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { I18N, type Lang } from '@/lib/i18n';
import { DEFAULT_OVERDUE_DAYS, isOverdue, locationLabel, overdueDays, toolMainName, toolMatches } from '@/lib/helpers';
import type { MachineInfo, Tool, ToolInput, User } from '@/lib/types';
import LoginForm from '@/components/LoginForm';
import DetailSheet from '@/components/DetailSheet';
import ToolFormSheet from '@/components/ToolFormSheet';
import { PasswordSheet, UsersSheet } from '@/components/AccountSheets';
import Sidebar from '@/components/Sidebar';
import Toast, { useToast } from '@/components/Toasts';

type Filter = null | 'store' | 'machine' | 'taken' | 'overdue';
type Sync = 'syncing' | 'synced' | 'offline';

const LANG_KEY = 'tool-tracker-lang-v3';
const OVERDUE_KEY = 'tool-tracker-overdue-days-v1';
const POLL_MS = 10_000;
const STATUS_COLOR = { store: '#278A59', taken: '#B7791F', machine: '#C0392B' } as const;

export default function Home() {
  const [lang, setLang] = useState<Lang>('en');
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [tools, setTools] = useState<Tool[]>([]);
  const [machines, setMachines] = useState<MachineInfo[]>([]);
  const [sync, setSync] = useState<Sync>('syncing');
  const [query, setQuery] = useState('');
  const [showSugg, setShowSugg] = useState(false);
  const [filter, setFilter] = useState<Filter>(null);
  const [threshold, setThreshold] = useState(DEFAULT_OVERDUE_DAYS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [highlightPid, setHighlightPid] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tool | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { msg, show, toast } = useToast();
  const searchRef = useRef<HTMLDivElement>(null);
  const t = I18N[lang];

  // ---- persisted preferences (language + overdue threshold live on this device) ----
  useEffect(() => {
    try {
      const l = localStorage.getItem(LANG_KEY);
      if (l === 'en' || l === 'si') setLang(l);
      const d = Number(localStorage.getItem(OVERDUE_KEY));
      if (Number.isFinite(d) && d >= 1) setThreshold(Math.min(d, 3650));
    } catch { /* storage unavailable */ }
  }, []);
  const changeLang = (l: Lang) => { setLang(l); try { localStorage.setItem(LANG_KEY, l); } catch {} document.documentElement.lang = l; };
  const changeThreshold = (v: string) => {
    const n = Math.min(Math.floor(Number(v)), 3650);
    if (!Number.isFinite(n) || n < 1) return;
    setThreshold(n);
    try { localStorage.setItem(OVERDUE_KEY, String(n)); } catch {}
  };

  // ---- data loading ----
  const reload = useCallback(async (quiet = true) => {
    if (!quiet) setSync('syncing');
    try {
      const [td, md] = await Promise.all([api.tools(), api.machines()]);
      setTools(td.tools);
      setMachines(md.machines);
      setSync('synced');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { setUser(null); return; }
      setSync('offline');
    }
  }, []);

  useEffect(() => {
    api.me().then((d) => setUser(d.user)).catch(() => {}).finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    reload(false);
    const id = setInterval(() => { if (document.visibilityState === 'visible') reload(); }, POLL_MS);
    return () => clearInterval(id);
  }, [user, reload]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!searchRef.current?.contains(e.target as Node)) setShowSugg(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // ---- auth ----
  async function login(email: string, password: string) {
    try { setLoginError(''); setUser((await api.login(email, password)).user); }
    catch (e) { setLoginError(e instanceof ApiError && e.status === 0 ? t.offlineError : (e as Error).message); }
  }
  async function logout() {
    try { await api.logout(); } catch {}
    setUser(null); setTools([]); setActiveId(null);
  }

  // ---- derived data ----
  const q = query.trim().toLowerCase();
  const counts = useMemo(() => {
    const c = { store: 0, machine: 0, taken: 0, overdue: 0 };
    tools.forEach((x) => { c[x.status]++; if (isOverdue(x, threshold)) c.overdue++; });
    return c;
  }, [tools, threshold]);

  const visible = useMemo(() => {
    let list = q ? tools.filter((x) => toolMatches(x, q)) : tools;
    if (filter === 'overdue') list = list.filter((x) => isOverdue(x, threshold));
    else if (filter) list = list.filter((x) => x.status === filter);
    return list;
  }, [tools, q, filter, threshold]);

  // One suggestion row per matching product (so every matching product ID shows), max 12.
  const suggestions = useMemo(() => {
    if (!q) return [];
    const rows: { tool: Tool; pid: string; label: string }[] = [];
    for (const tool of tools) {
      const hits = tool.products.filter((p) => p.pid.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
      if (hits.length) hits.forEach((p) => rows.push({ tool, pid: p.pid, label: p.desc }));
      else if (tool.toolCode.toLowerCase().includes(q)) rows.push({ tool, pid: tool.products[0]?.pid ?? '', label: toolMainName(tool) });
    }
    return rows.slice(0, 12);
  }, [tools, q]);

  const active = tools.find((x) => x.id === activeId) ?? null;
  const canEdit = user?.role === 'admin' || user?.role === 'operator';
  const isAdmin = user?.role === 'admin';

  // ---- actions ----
  const fail = useCallback((e: unknown) => {
    toast(e instanceof ApiError && e.status === 0 ? t.offlineError : (e as Error).message);
  }, [toast, t.offlineError]);

  const apply = (updated: Tool) => { setTools((list) => list.map((x) => (x.id === updated.id ? updated : x))); setHistoryKey((k) => k + 1); reload(); };

  async function assign(tool: Tool, name: string) {
    if (!name.trim()) return toast(t.toastEnterMachine);
    try { apply((await api.assignTool(tool.id, name.trim())).tool); setActiveId(null); toast(`${tool.toolCode} → ${name.trim()}`); } catch (e) { fail(e); reload(); }
  }
  async function takeOut(tool: Tool, note: string) {
    try { apply((await api.takeOutTool(tool.id, note.trim())).tool); setActiveId(null); toast(t.toastTaken(tool.toolCode)); } catch (e) { fail(e); }
  }
  async function giveBack(tool: Tool) {
    try { apply((await api.returnTool(tool.id)).tool); setActiveId(null); toast(t.toastReturned(tool.toolCode)); } catch (e) { fail(e); }
  }
  async function remove(tool: Tool) {
    if (!confirm(t.confirmDelete(tool.toolCode))) return;
    try { await api.deleteTool(tool.id); setActiveId(null); setTools((l) => l.filter((x) => x.id !== tool.id)); toast(t.toastDeleted); reload(); } catch (e) { fail(e); }
  }
  async function save(input: ToolInput) {
    try {
      const res = editing ? await api.updateTool(editing.id, input, editing.version) : await api.createTool(input);
      toast(editing ? t.toastUpdated(res.tool.toolCode) : t.toastAdded(res.tool.toolCode));
      setFormOpen(false); setEditing(null);
      if (editing) setActiveId(res.tool.id);
      setHistoryKey((k) => k + 1);
      reload();
    } catch (e) { fail(e); if (editing) reload(); }
  }

  const openDetail = (id: string, pid: string | null = null) => { setHighlightPid(pid); setActiveId(id); setShowSugg(false); };
  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (tool: Tool) => { setEditing(tool); setActiveId(null); setFormOpen(true); };
  const toggleFilter = (f: Exclude<Filter, null>) => setFilter((cur) => (cur === f ? null : f));

  if (booting) return <div className="boot">…</div>;
  if (!user) return <LoginForm lang={lang} onLang={changeLang} onLogin={login} error={loginError} />;

  const syncText = sync === 'synced' ? t.synced : sync === 'offline' ? t.offline : t.syncing;

  return (
    <>
      <Sidebar
        open={navOpen} lang={lang} user={user} filter={filter} counts={counts} total={tools.length} sync={sync} syncText={syncText}
        onFilter={setFilter} onLang={changeLang} onPassword={() => setPwOpen(true)} onUsers={() => setUsersOpen(true)} onLogout={logout} onClose={() => setNavOpen(false)}
      />
      <div id="app">
        <header className="top">
          <div className="brand-row">
            <button className="menu-btn" onClick={() => setNavOpen(true)} aria-label="Menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
            </button>
            <svg className="brand-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M14.7 6.3a1 1 0 0 0-1.4 0L11 8.6 15.4 13l2.3-2.3a1 1 0 0 0 0-1.4l-3-3Z" stroke="#F2B705" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="m11 8.6-7.4 7.4a2 2 0 0 0 2.4 3.1l7.9-6.7" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="6" cy="18" r="1.3" fill="#F2B705" />
            </svg>
            <div>
              <div className="brand-title">{t.brandTitle}</div>
              <div className="brand-sub">{t.brandSub}</div>
              <div className={'brand-sub sync ' + sync}>{syncText}</div>
            </div>
            <div className="lang-toggle">
              <button className={'lang-btn' + (lang === 'en' ? ' active' : '')} onClick={() => changeLang('en')}>EN</button>
              <button className={'lang-btn' + (lang === 'si' ? ' active' : '')} onClick={() => changeLang('si')}>සිං</button>
            </div>
          </div>

          <div className="search-wrap" ref={searchRef}>
            <div className="search-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="11" cy="11" r="7" stroke="#7B8794" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="#7B8794" strokeWidth="2" strokeLinecap="round" /></svg>
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowSugg(true); }}
                onFocus={() => setShowSugg(true)}
                placeholder={t.searchPh}
                autoComplete="off"
                aria-label={t.searchPh}
              />
              {query && (
                <button className="clear-btn" aria-label="Clear" onClick={() => { setQuery(''); setShowSugg(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="#52606D" strokeWidth="2.2" strokeLinecap="round" /></svg>
                </button>
              )}
            </div>
            {showSugg && suggestions.length > 0 && (
              <div className="suggestions">
                {suggestions.map((r, i) => (
                  <div className="sugg-item" key={r.tool.id + r.pid + i} onClick={() => openDetail(r.tool.id, r.pid || null)}>
                    <span className="sugg-id">{r.tool.toolCode}</span>
                    <span className="sugg-mid"><div className="sugg-name">{r.label}</div><div className="sugg-pid">{r.pid}</div></span>
                    <span className="sugg-status" style={{ color: STATUS_COLOR[r.tool.status] }}>{locationLabel(r.tool, lang)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>

        <main>
          <div className="stats-row">
            {([['store', t.statStore, counts.store], ['machine', t.statMachine, counts.machine], ['taken', t.statTaken, counts.taken], ['overdue', t.statOverdue, counts.overdue]] as const).map(([key, label, n]) => (
              <button key={key} className={'stat-chip' + (filter === key ? ' active' : '')} onClick={() => toggleFilter(key)}>
                <div className="stat-count">{n}</div>
                <div className="stat-label"><span className={'stat-dot ' + key} /><span>{label}</span></div>
              </button>
            ))}
          </div>

          {filter === 'overdue' && (
            <div className="overdue-setting">
              <label htmlFor="od">{t.overdueAfter}</label>
              <input id="od" type="number" min={1} max={3650} inputMode="numeric" defaultValue={threshold} key={threshold} onBlur={(e) => changeThreshold(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') changeThreshold((e.target as HTMLInputElement).value); }} />
              <span>{t.daysLabel}</span>
            </div>
          )}

          <div className="section-label">{t.allTools} <span className="count-pill">{tools.length}</span></div>

          {tools.length === 0 && sync !== 'syncing' ? (
            <div className="empty-state"><p dangerouslySetInnerHTML={{ __html: sync === 'offline' ? t.offlineError : t.emptyNoTools }} /></div>
          ) : visible.length === 0 ? (
            <div className="empty-state"><p>{t.emptyNoMatch}</p></div>
          ) : (
            visible.map((tool) => {
              const late = isOverdue(tool, threshold);
              return (
                <div className="tool-card" key={tool.id} role="button" tabIndex={0} onClick={() => openDetail(tool.id)} onKeyDown={(e) => { if (e.key === 'Enter') openDetail(tool.id); }}>
                  <div className="tool-id-badge">{tool.toolCode}</div>
                  <div className="tool-info">
                    <div className="tool-name">{toolMainName(tool)}</div>
                    <div className="tool-status-line">
                      <span className={'dot ' + tool.status} />
                      <span>{locationLabel(tool, lang)}</span>
                      {late && <span className="overdue-tag">{t.overdueDays(overdueDays(tool))}</span>}
                    </div>
                  </div>
                  {tool.size && <span className="size-tag">{tool.size}T</span>}
                  <svg className="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              );
            })
          )}
        </main>

        {canEdit && (
          <button className="fab-inner" onClick={openAdd} aria-label={t.addTitle}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>
          </button>
        )}
      </div>

      <DetailSheet
        tool={active} lang={lang} query={q} highlightPid={highlightPid} threshold={threshold}
        canEdit={!!canEdit} isAdmin={!!isAdmin} machines={machines} historyKey={historyKey}
        onClose={() => setActiveId(null)} onAssign={assign} onTakeOut={takeOut} onReturn={giveBack} onEdit={openEdit} onDelete={remove}
      />
      <ToolFormSheet open={formOpen} tool={editing} lang={lang} onClose={() => { setFormOpen(false); setEditing(null); }} onSave={save} onError={toast} />
      <PasswordSheet open={pwOpen} lang={lang} onClose={() => setPwOpen(false)} onDone={(m) => { setPwOpen(false); toast(m); }} onError={toast} />
      <UsersSheet open={usersOpen} lang={lang} meId={user.id} onClose={() => setUsersOpen(false)} onError={toast} onDone={toast} />
      <Toast msg={msg} show={show} />
    </>
  );
}
