"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useApp } from "@/components/AppLayout";
import { useConfirm } from "@/components/ConfirmHost";
import Icon from "@/components/Icon";
import { api } from "@/utils/api";
import { errorText } from "@/utils/format";
import { can, PERMISSIONS, type Permission } from "@/utils/permissions";
import type { RoleAccess, UserAccess } from "@/utils/types";

// Access Control (System Administrator). Everyone else sees a read-only list of their own effective permissions.
const input =
  "min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] w-full";
const btn = "tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96";
const same = (a: Permission[], b: Permission[]) => a.length === b.length && a.every((p) => b.includes(p));
const ordered = (list: Permission[]) => PERMISSIONS.filter((p) => list.includes(p));

type UserDraft = { grant: Permission[]; deny: Permission[]; expiresAt: string };

export default function AccessPage() {
  const { user, translations } = useApp();
  const t = translations.accessAdmin;
  const { confirm } = useConfirm();
  const admin = can(user, "access.manage");
  const [tab, setTab] = useState<"roles" | "users">("roles");
  const [roles, setRoles] = useState<RoleAccess[]>([]);
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, Permission[]>>({});
  const [selectedId, setSelectedId] = useState("");
  const [userDraft, setUserDraft] = useState<UserDraft>({ grant: [], deny: [], expiresAt: "" });
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.userAccess();
      setRoles(response.roles);
      setUsers(response.users);
      setCatalog(response.permissions);
      setRoleDrafts(Object.fromEntries(response.roles.map((r) => [r.role, r.permissions])));
    } catch (err) {
      setError(errorText(err, translations));
    } finally {
      setLoading(false);
    }
  }, [admin, translations]);
  useEffect(() => { void load(); }, [load]);

  const selected = users.find((u) => u.id === selectedId);
  const pickUser = (u: UserAccess | undefined) => {
    setSelectedId(u?.id ?? "");
    const o = u?.permissionOverrides;
    setUserDraft({ grant: o?.grant ?? [], deny: o?.deny ?? [], expiresAt: o?.expiresAt ? o.expiresAt.slice(0, 10) : "" });
  };
  const preview = useMemo(() => {
    if (!selected) return [];
    const set = new Set([...selected.rolePermissions, ...userDraft.grant]);
    userDraft.deny.forEach((p) => set.delete(p));
    return ordered([...set]);
  }, [selected, userDraft]);

  const reasonOk = reason.trim().length >= 3;
  async function guarded(title: string, message: string, work: () => Promise<void>) {
    if (!reasonOk) return void toast.error(t.reasonRequired);
    if (saving || !(await confirm({ title, message, confirmText: translations.confirm.saveBtn }))) return;
    setSaving(true);
    try {
      await work();
      toast.success(translations.feedback.saved);
      setReason("");
    } catch (err) {
      toast.error(errorText(err, translations));
    } finally {
      setSaving(false);
    }
  }

  const saveRole = (r: RoleAccess, permissions: Permission[] | null) =>
    guarded(t.confirmTitle, t.confirmMatrix(translations.roles[r.role]), async () => {
      const { role } = await api.updateRoleAccess(r.role, { permissions, version: r.version, reason: reason.trim() });
      setRoles((cur) => cur.map((x) => (x.role === role.role ? role : x)));
      setRoleDrafts((cur) => ({ ...cur, [role.role]: role.permissions }));
      setUsers((cur) => cur.map((u) => (u.role === role.role ? { ...u, rolePermissions: role.permissions } : u)));
    });

  const saveUser = (reset: boolean) => {
    if (!selected) return;
    const body = reset
      ? { grant: [], deny: [], expiresAt: null, reason: reason.trim() }
      : { grant: userDraft.grant, deny: userDraft.deny, expiresAt: userDraft.expiresAt ? new Date(userDraft.expiresAt + "T23:59:59").toISOString() : null, reason: reason.trim() };
    return guarded(t.confirmTitle, reset ? t.confirmReset(selected.name) : t.confirmUser(selected.name), async () => {
      const response = await api.updateUserAccess(selected.id, body);
      setUsers((cur) => cur.map((u) => (u.id === response.user.id ? response.user : u)));
      pickUser(response.user);
    });
  };

  // One tap cycles: role permission -> removed -> role permission; other permission -> extra -> not included.
  function toggle(p: Permission) {
    if (!selected) return;
    setUserDraft((d) => {
      if (selected.rolePermissions.includes(p)) return { ...d, deny: d.deny.includes(p) ? d.deny.filter((x) => x !== p) : [...d.deny, p] };
      return { ...d, grant: d.grant.includes(p) ? d.grant.filter((x) => x !== p) : [...d.grant, p] };
    });
  }
  const stateOf = (p: Permission) => {
    if (!selected) return "";
    if (userDraft.deny.includes(p)) return "denied";
    if (userDraft.grant.includes(p)) return "granted";
    return selected.rolePermissions.includes(p) ? "fromRole" : "notIncluded";
  };
  const stateClass: Record<string, string> = {
    fromRole: "bg-surface-2 text-ink",
    granted: "bg-good-bg text-good-ink border-good!",
    denied: "bg-danger-bg text-danger-ink border-danger! line-through",
    notIncluded: "bg-surface text-ink-faint",
  };

  const main = "pt-5 pb-8 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1200px]";

  // Read-only: own effective permissions.
  if (!admin) {
    return (
      <main className={main}>
        <h2 className="text-lg font-extrabold mb-2 flex items-center gap-2"><Icon name="admin" />{t.myAccess}</h2>
        <p className="text-sm text-ink-soft mb-4">{t.myAccessHint}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {ordered(user?.permissions ?? []).map((p) => (
            <li key={p} className="rounded-md bg-surface-2 p-3 text-sm font-bold flex gap-2 items-start"><Icon name="confirm" size={16} />{t.labels[p]}</li>
          ))}
        </ul>
      </main>
    );
  }

  const roleList = roles;
  const visibleUsers = users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(query.trim().toLowerCase()));
  const reasonField = (
    <div className="mb-4">
      <label className="block mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="access-reason">{t.reason}</label>
      <input id="access-reason" className={input} value={reason} maxLength={500} disabled={saving} aria-invalid={reason.length > 0 && !reasonOk} onChange={(e) => setReason(e.target.value)} />
      <p className="text-xs text-ink-soft mt-1">{t.reasonHint}</p>
    </div>
  );

  return (
    <main className={main}>
      <h2 className="text-lg font-extrabold mb-3 flex items-center gap-2"><Icon name="admin" />{t.title}</h2>
      <p className="text-sm text-ink-soft mb-4">{t.protected}</p>
      <div className="flex gap-2 mb-4" role="group" aria-label={t.title}>
        {(["roles", "users"] as const).map((value) => (
          <button key={value} type="button" disabled={saving} aria-pressed={tab === value} className={(tab === value ? "primary " : "") + btn} onClick={() => setTab(value)}>
            {t.tabs[value]}
          </button>
        ))}
      </div>
      {loading ? <p role="status">{translations.feedback.working}</p> : error ? (
        <div role="alert"><p>{error}</p><button className={btn} onClick={() => void load()}>{t.retry}</button></div>
      ) : tab === "roles" ? (
        <>
          {reasonField}
          <div className="overflow-x-auto border border-solid border-line rounded-lg">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-surface-2">
                  <th className="text-left p-2 sticky left-0 bg-surface-2 min-w-[220px]">{t.permission}</th>
                  {roleList.map((r) => <th key={r.role} className="p-2 text-center min-w-[96px]">{translations.roles[r.role]}</th>)}
                </tr>
              </thead>
              <tbody>
                {catalog.map((p) => (
                  <tr key={p} className="[border-top:1px_solid_var(--line)]">
                    <td className="p-2 sticky left-0 bg-surface font-semibold">{t.labels[p]}</td>
                    {roleList.map((r) => {
                      const draft = roleDrafts[r.role] ?? [];
                      const locked = p === "move.outOfService" && r.role !== "super_admin";
                      return (
                        <td key={r.role} className="p-2 text-center">
                          <input type="checkbox" aria-label={`${translations.roles[r.role]}: ${t.labels[p]}`} disabled={saving || locked} checked={draft.includes(p)}
                            onChange={(e) => setRoleDrafts((cur) => ({ ...cur, [r.role]: e.target.checked ? [...draft, p] : draft.filter((x) => x !== p) }))} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="[border-top:1px_solid_var(--line)] bg-surface-2">
                  <td className="p-2 sticky left-0 bg-surface-2" />
                  {roleList.map((r) => {
                    const dirty = !same(roleDrafts[r.role] ?? [], r.permissions);
                    return (
                      <td key={r.role} className="p-2 text-center align-top">
                        <button type="button" className={"primary text-xs! min-h-9! px-2! " + btn} disabled={saving || !dirty} onClick={() => void saveRole(r, ordered(roleDrafts[r.role] ?? []))}>{translations.confirm.saveBtn}</button>
                        <button type="button" className={"text-xs! min-h-9! px-2! mt-1 " + btn} disabled={saving || (!r.customised && !dirty)} onClick={() => void saveRole(r, null)}>{t.resetDefaults}</button>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          <div>
            <label className="block mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="access-search">{t.search}</label>
            <input id="access-search" type="search" className={input + " mb-2"} value={query} onChange={(e) => setQuery(e.target.value)} />
            <ul className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
              {visibleUsers.map((u) => (
                <li key={u.id}>
                  <button type="button" disabled={saving} aria-pressed={u.id === selectedId} onClick={() => pickUser(u)}
                    className={"w-full text-left rounded-md p-2 border border-solid " + (u.id === selectedId ? "border-ink bg-surface-2" : "border-line bg-surface")}>
                    <span className="font-bold block break-words">{u.name}</span>
                    <span className="text-xs text-ink-soft">{translations.roles[u.role]}</span>
                    {u.permissionOverrides && (
                      <span className={"ml-2 text-[11px] font-extrabold rounded-pill px-1.5 " + (u.permissionOverrides.active ? "bg-warn-bg text-warn-ink" : "bg-surface-3 text-ink-faint")}>
                        {t.overrides}{!u.permissionOverrides.active && ` · ${t.expired}`}
                      </span>
                    )}
                  </button>
                </li>
              ))}
              {!visibleUsers.length && <li className="text-sm">{t.none}</li>}
            </ul>
          </div>
          {!selected ? <p>{t.noSelection}</p> : (
            <section className="bg-surface border border-solid border-line rounded-lg p-4">
              <h3 className="font-extrabold text-lg break-words">{selected.name}</h3>
              <p className="text-sm text-ink-soft mb-3">{translations.roles[selected.role]} · {selected.email}</p>
              <p className="text-sm mb-3">{t.tapToCycle}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {catalog.map((p) => {
                  const state = stateOf(p);
                  const locked = p === "move.outOfService" && selected.role !== "super_admin";
                  return (
                    <button key={p} type="button" disabled={saving || locked} onClick={() => toggle(p)}
                      className={"text-left rounded-md p-2.5 border-[1.5px] border-solid border-line text-sm " + stateClass[state]}>
                      <span className="font-bold block">{t.labels[p]}</span>
                      <span className="text-xs">{t[state as "fromRole" | "granted" | "denied" | "notIncluded"]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 mt-4">
                <div>
                  <label className="block mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="access-expiry">{t.expiry}</label>
                  <input id="access-expiry" type="date" className={input} value={userDraft.expiresAt} min={new Date().toISOString().slice(0, 10)} disabled={saving}
                    onChange={(e) => setUserDraft((d) => ({ ...d, expiresAt: e.target.value }))} />
                </div>
              </div>
              <div className="mt-3">{reasonField}</div>
              <h4 className="font-extrabold mt-2 mb-1">{t.effective} <small className="text-ink-soft font-normal">· {t.effectiveCount(preview.length)}</small></h4>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {preview.map((p) => <span key={p} className="text-xs rounded-pill bg-surface-2 px-2 py-1">{t.labels[p]}</span>)}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={"primary " + btn} disabled={saving} onClick={() => void saveUser(false)}>{t.save}</button>
                <button type="button" className={btn} disabled={saving || !selected.permissionOverrides} onClick={() => void saveUser(true)}>{t.resetUser}</button>
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
