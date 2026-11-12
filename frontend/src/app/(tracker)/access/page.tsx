"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useApp } from "@/components/AppLayout";
import Icon from "@/components/Icon";
import { api } from "@/utils/api";
import { errorText } from "@/utils/format";
import { can, type Permission } from "@/utils/permissions";
import type { UserAccess, RoleAccess } from "@/utils/types";

export default function AccessPage() {
  const { user, translations } = useApp();
  const text = translations.accessAdmin;
  const allowed = can(user, "access.manage");
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [roles, setRoles] = useState<RoleAccess[]>([]);
  const [mode, setMode] = useState<"roles" | "users">("roles");
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const accounts: UserAccess[] = mode === "users" ? users : roles.map(config => ({
    ...config, id: config.role, name: translations.roles[config.role], email: "", language: "en", active: true,
    rolePermissions: config.permissions,
  }));
  const selected = accounts.find(account => account.id === selectedId);
  const dirty = Boolean(selected && (selected.permissions.length !== draft.length || selected.permissions.some(permission => !draft.includes(permission))));

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.userAccess();
      setUsers(response.users);
      setRoles(response.roles);
      setCatalog(response.permissions);
      setSelectedId("");
      setDraft([]);
    } catch (err) {
      setError(errorText(err, translations));
    } finally {
      setLoading(false);
    }
  }, [allowed, translations]);
  useEffect(() => { void load(); }, [load]);

  async function persist(permissions: Permission[] | null) {
    if (!selected || saving) return;
    setSaving(true);
    try {
      if (mode === "roles") {
        const response = await api.updateRoleAccess(selected.role, permissions);
        setRoles(current => current.map(config => config.role === response.role.role ? response.role : config));
        setUsers(current => current.map(account => account.role === response.role.role ? {
          ...account, rolePermissions: response.role.permissions,
          permissions: account.permissionOverrides ?? response.role.permissions,
        } : account));
        setDraft(response.role.permissions);
        toast.success(translations.feedback.saved);
        return;
      }
      const response = await api.updateUserAccess(selected.id, permissions);
      setUsers(current => current.map(account => account.id === response.user.id ? response.user : account));
      setDraft(response.user.permissions);
      toast.success(translations.feedback.saved);
    } catch (err) {
      toast.error(errorText(err, translations));
    } finally {
      setSaving(false);
    }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void persist(draft);
  }

  if (!allowed) return null;
  const visible = accounts.filter(account => `${account.name} ${account.email}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <main className="pt-5 pb-0 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1100px]">
      <h2 className="text-lg font-extrabold mb-3 flex items-center gap-2"><Icon name="admin" />{text.title}</h2>
      <p className="text-sm text-ink-soft mb-4">{text.protected}</p>
      <div className="flex gap-2 mb-4" role="group" aria-label={text.title}>
        {(["roles", "users"] as const).map(value => <button key={value} type="button" disabled={saving} aria-pressed={mode === value} className={mode === value ? "primary" : ""} onClick={() => {
          setMode(value); setSelectedId(""); setDraft([]); setQuery("");
        }}>{value === "roles" ? text.roleAccess : text.userAccess}</button>)}
      </div>
      {mode === "roles" && <p className="text-sm mb-4">{text.roleHint}</p>}
      {loading ? <p role="status">{translations.feedback.working}</p> : error ? (
        <div role="alert"><p>{error}</p><button className="tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96" onClick={() => void load()}>{text.retry}</button></div>
      ) : <>
        <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="access-search">{mode === "roles" ? text.searchRole : text.search}</label>
        <input id="access-search" className="min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] w-full mb-3" type="search" value={query} disabled={saving} onChange={event => setQuery(event.target.value)} />
        <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="access-user">{mode === "roles" ? text.chooseRole : text.choose}</label>
        <select id="access-user" className="min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] w-full mb-4" value={selectedId} disabled={saving} onChange={event => {
          const account = accounts.find(account => account.id === event.target.value);
          setSelectedId(event.target.value);
          setDraft(account?.permissions ?? []);
        }}>
          <option value="">{mode === "roles" ? text.chooseRole : text.choose}</option>
          {selected && !visible.some(account => account.id === selected.id) && <option value={selected.id}>{selected.name} ({selected.email})</option>}
          {visible.map(account => <option key={account.id} value={account.id}>{account.name}{account.email ? ` (${account.email})` : ""}</option>)}
        </select>
        {visible.length === 0 && <p className="text-sm mb-3">{mode === "roles" ? text.noRoles : text.none}</p>}
        {!selected ? <p>{mode === "roles" ? text.chooseRole : text.noSelection}</p> : <form onSubmit={save} className="bg-surface border border-solid border-line rounded-lg p-4">
          <h3 className="font-extrabold text-lg break-words">{selected.name}</h3>
          <p className="text-sm text-ink-soft mb-3">{translations.roles[selected.role]} · {selected.permissionOverrides === null ? (mode === "roles" ? text.builtIn : text.defaults) : text.custom}</p>
          <p className="text-sm mb-4">{mode === "roles" ? text.roleHint : text.hint}</p>
          <fieldset disabled={saving} className="border-0 p-0 m-0 min-w-0">
            <legend className="sr-only">{text.title}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {catalog.map(permission => <label key={permission} className="flex items-start gap-3 min-h-11 rounded-md bg-surface-2 p-3 cursor-pointer">
                <input className="mt-1" type="checkbox" disabled={permission === "move.outOfService" && selected.role !== "super_admin"} checked={draft.includes(permission)} onChange={event => {
                  setDraft(current => event.target.checked ? [...current, permission] : current.filter(value => value !== permission));
                }} />
                <span className="text-sm font-bold">{text.labels[permission]}</span>
              </label>)}
            </div>
            {draft.length === 0 && <p className="text-sm mt-3" role="status">{mode === "roles" ? text.noRoleAccess : text.noAccess}</p>}
            <div className="flex flex-wrap gap-2 mt-4">
              <button type="submit" className="primary tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96" disabled={!dirty}>{saving ? translations.feedback.working : translations.confirm.saveBtn}</button>
              <button type="button" className="tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96" disabled={selected.permissionOverrides === null && !dirty} onClick={() => void persist(null)}>{mode === "roles" ? text.resetRole : text.reset}</button>
            </div>
          </fieldset>
        </form>}
      </>}
    </main>
  );
}
