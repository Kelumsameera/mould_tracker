"use client";
import { useApp } from "@/components/AppLayout";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/utils/api";

import { errorText } from "@/utils/format";
import toast from "react-hot-toast";
import { useConfirm, type ConfirmOptions } from "@/components/ConfirmHost";
import Icon from "@/components/Icon";
import { assignableRoles } from "@/utils/permissions";
import type { Role, User } from "@/utils/types";

export default function UsersPage() {
  const { user: currentUser, translations, setUser: onUpdated } = useApp();

  const { confirm } = useConfirm();
  // Screen state
  const [editing, setEditing] = useState<User | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "mould_technician" as Role,
  });
  const roles = assignableRoles(currentUser);
  // Admins cannot change Super Admin accounts (the server refuses too).
  // Button and form actions
  function isUserLocked(listedUser: User) {
    if (listedUser.id === currentUser.id) {
      return true;
    }
    if (listedUser.role === "super_admin" && !["system_admin", "super_admin"].includes(currentUser.role)) {
      return true;
    }
    return false;
  }

  function renderRoleOptions(currentRole?: Role) {
    const availableRoles: Role[] = [];
    if (currentRole) {
      availableRoles.push(currentRole);
    }
    for (const role of roles) {
      if (!availableRoles.includes(role)) {
        availableRoles.push(role);
      }
    }

    return availableRoles.map((role) => {
      return (
        <option key={role} value={role}>
          {translations.roles[role]}
        </option>
      );
    });
  }

  const loadUsers = useCallback(async () => {
    try {
      const response = await api.users();
      setUsers(response.users);
    } catch (error) {
      toast.error(errorText(error, translations));
    }
  }, [toast, translations]);
  // Effects: load data and update the screen
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // One confirm (when asked for), then loading -> success/error toasts; no double submit while saving.
  async function runUserAction(
    saveChanges: () => Promise<unknown>,
    successMessage: string,
    confirmationOptions?: ConfirmOptions,
  ) {
    if (saving) {
      return false;
    }
    if (confirmationOptions) {
      const isConfirmed = await confirm(confirmationOptions);
      if (!isConfirmed) {
        return false;
      }
    }
    setSaving(true);
    try {
      await toast.promise(
        saveChanges,
        {
          loading: translations.feedback.working,
          success: successMessage,
          error: (error) => errorText(error, translations),
        },
      );
      await loadUsers();
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function saveUser(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || saving) return;
    const userChanges: { name: string; email: string; password?: string } = {
      name: editing.name,
      email: editing.email,
    };
    if (editPassword !== "") {
      userChanges.password = editPassword;
    }

    let confirmationOptions: ConfirmOptions | undefined;
    if (editPassword !== "") {
      confirmationOptions = {
        title: translations.confirm.accountTitle,
        message: translations.confirm.userPassword(editing.name),
        confirmText: translations.confirm.accountBtn,
      };
    }

    const userId = editing.id;
    async function updateUser() {
      const response = await api.updateUser(userId, userChanges);
      if (response.user && response.user.id === currentUser.id) {
        onUpdated(response.user);
      }
    }

    const wasSaved = await runUserAction(
      updateUser,
      translations.userSaved,
      confirmationOptions,
    );
    if (wasSaved) {
      setEditing(null);
      setEditPassword("");
    }
  }

  // UI and inline Tailwind styles
  return (
    <main className="pt-5 pb-0 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1100px]">
      <h2 className="text-xl font-extrabold [margin:var(--s2)_0_var(--s4)] leading-[1.3]">
        {translations.users}
      </h2>
      <p className="text-sm leading-[1.5] text-ink-soft mx-0 mt-2 mb-0">
        {translations.rolesHelp}
      </p>
      {editing && (
        <form onSubmit={saveUser}>
          <h3 className="text-md [margin:var(--s5)_0_var(--s3)]">
            {editing.email}
          </h3>
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="edit-user-name">
            {translations.name}
          </label>
          <input
            id="edit-user-name"
            className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
            required
            maxLength={120}
            disabled={saving}
            value={editing.name}
            onChange={(event) => setEditing({ ...editing, name: event.target.value })}
          />
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="edit-user-email">
            {translations.email}
          </label>
          <input
            id="edit-user-email"
            className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
            type="email"
            required
            disabled={saving}
            value={editing.email}
            onChange={(event) => setEditing({ ...editing, email: event.target.value })}
          />
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="edit-user-password">
            {translations.newPassword}
          </label>
          <input
            id="edit-user-password"
            className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            disabled={saving}
            value={editPassword}
            onChange={(event) => setEditPassword(event.target.value)}
          />
          <div className="flex gap-2 items-center mt-3 [&>button:first-child]:shrink-0 [&>button:last-child]:flex-1 [&>button:last-child]:mt-0 max-md:in-data-[sheet]:sticky max-md:in-data-[sheet]:bottom-[calc(-1*var(--s4))] max-md:in-data-[sheet]:bg-surface max-md:in-data-[sheet]:pt-3 max-md:in-data-[sheet]:pb-[calc(var(--s3)+var(--safe-b))] max-md:in-data-[sheet]:-mb-4 max-md:in-data-[sheet]:[border-top:1px_solid_var(--line)] max-md:in-data-[sheet]:z-2">
            <button
              className="bg-transparent border-0 text-action font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default"
              type="button"
              disabled={saving}
              onClick={() => {
                setEditing(null);
                setEditPassword("");
              }}
            >
              <Icon name="cancel" />
              {translations.cancel}
            </button>
            <button
              className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-action text-white tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96 active:bg-action-dark shadow-[inset_0_-2px_0_rgba(0,0,0,.18)]"
              disabled={saving}
            >
              <Icon name="confirm" />
              {translations.saveBtn}
            </button>
          </div>
        </form>
      )}
      <div className="flex flex-col">
        {users.map((listedUser) => (
          <div
            className={
              "flex items-center gap-2 [padding:var(--s3)_0] [border-bottom:1px_solid_var(--line)] flex-wrap [&_select]:border [&_select]:border-solid [&_select]:border-line [&_select]:rounded-sm [&_select]:min-h-tap [&_select]:px-2 [&_select]:bg-surface-2 [&_select]:text-ink [&_select]:[font:inherit] [&_select]:text-sm [&_select]:max-w-full" +
              (listedUser.active ? "" : " [&>div:first-child]:opacity-50")
            }
            key={listedUser.id}
          >
            <div className="flex-1 min-w-[180px] flex flex-col text-md [&_small]:text-ink-soft [&_small]:overflow-hidden [&_small]:text-ellipsis">
              <b>{listedUser.name}</b>
              <small>{listedUser.email}</small>
              <span>
                <button
                  className="bg-transparent border-0 text-action font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default"
                  disabled={saving || (isUserLocked(listedUser) && listedUser.id !== currentUser.id)}
                  onClick={() => {
                    setEditing(listedUser);
                    setEditPassword("");
                  }}
                >
                  {translations.editUser}
                </button>
                {!isUserLocked(listedUser) && (
                  <button
                    className="bg-transparent border-0 font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default text-danger"
                    disabled={saving}
                    onClick={() =>
                      runUserAction(() => api.deleteUser(listedUser.id), translations.userDeleted, {
                        title: translations.confirm.deleteUserTitle,
                        message: translations.confirm.deleteUser(listedUser.name),
                        confirmText: translations.confirm.deleteBtn,
                        tone: "danger",
                      })
                    }
                  >
                    {translations.deleteUser}
                  </button>
                )}
              </span>
            </div>
            <select
              aria-label={translations.role}
              value={listedUser.role}
              disabled={saving || isUserLocked(listedUser)}
              onChange={(event) => {
                const role = event.target.value as Role;
                runUserAction(() => api.updateUser(listedUser.id, { role }), translations.userSaved, {
                  title: translations.confirm.roleTitle,
                  message: translations.confirm.role(
                    listedUser.name,
                    translations.roles[listedUser.role],
                    translations.roles[role],
                  ),
                  confirmText: translations.confirm.roleBtn,
                  tone: ["system_admin", "super_admin"].includes(role) ? "danger" : "default",
                });
              }}
            >
              {renderRoleOptions(listedUser.role)}
            </select>
            <button
              className="bg-transparent border-0 text-action font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default"
              disabled={saving || isUserLocked(listedUser)}
              onClick={() =>
                runUserAction(
                  () => api.updateUser(listedUser.id, { active: !listedUser.active }),
                  translations.userSaved,
                  listedUser.active
                    ? {
                        title: translations.confirm.disableUserTitle,
                        message: translations.confirm.disableUser(listedUser.name),
                        confirmText: translations.confirm.disableBtn,
                        tone: "danger",
                      }
                    : {
                        title: translations.confirm.enableUserTitle,
                        message: translations.confirm.enableUser(listedUser.name),
                        confirmText: translations.confirm.enableBtn,
                      },
                )
              }
            >
              {listedUser.active ? translations.active : translations.disabled}
            </button>
          </div>
        ))}
      </div>
      <h3 className="text-md [margin:var(--s5)_0_var(--s3)]">
        {translations.addUser}
      </h3>
      <input
        className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
        placeholder={translations.name}
        aria-label={translations.name}
        value={form.name}
        onChange={(event) => setForm({ ...form, name: event.target.value })}
      />
      <input
        className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink mt-3 focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
        type="email"
        placeholder={translations.email}
        aria-label={translations.email}
        value={form.email}
        onChange={(event) => setForm({ ...form, email: event.target.value })}
      />
      <input
        className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink mt-3 focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
        type="password"
        autoComplete="new-password"
        placeholder={translations.newPassword}
        aria-label={translations.newPassword}
        value={form.password}
        onChange={(event) => setForm({ ...form, password: event.target.value })}
      />
      <select
        className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink mt-3 focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
        aria-label={translations.role}
        value={form.role}
        onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
      >
        {renderRoleOptions()}
      </select>
      <button
        className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-action text-white tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96 active:bg-action-dark shadow-[inset_0_-2px_0_rgba(0,0,0,.18)]"
        disabled={saving}
        onClick={async () => {
          if (await runUserAction(() => api.createUser(form), translations.userAdded))
            setForm({
              name: "",
              email: "",
              password: "",
              role: "mould_technician",
            });
        }}
      >
        <Icon name="add" />
        {translations.addUser}
      </button>
    </main>
  );
}
