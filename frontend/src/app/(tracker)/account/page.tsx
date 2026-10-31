"use client";
import { useApp } from "@/components/AppLayout";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/utils/api";
import { errorText } from "@/utils/format";

import toast from "react-hot-toast";
import { useConfirm } from "@/components/ConfirmHost";
import Icon from "@/components/Icon";

export default function AccountPage() {
  const { translations, user, setUser: onUpdated } = useApp();
  const router = useRouter();
  const goToFindPage = () => router.push("/find");

  const { confirm } = useConfirm();
  // Screen state
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Effects: load data and update the screen
  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }, [user.name, user.email]);
  // Button and form actions
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSaving) return;
    if (newPassword !== confirmPassword) {
      toast.error(translations.pwMismatch);
      return;
    }

    let confirmationMessage = translations.confirm.account;
    if (newPassword !== "") {
      confirmationMessage = translations.confirm.password;
    }
    const isConfirmed = await confirm({
      title: translations.confirm.accountTitle,
      message: confirmationMessage,
      confirmText: translations.confirm.accountBtn,
    });
    if (!isConfirmed) {
      return;
    }

    setIsSaving(true);
    try {
      const profileChanges: {
        name: string;
        email: string;
        currentPassword: string;
        newPassword?: string;
      } = {
        name: name,
        email: email,
        currentPassword: currentPassword,
      };
      if (newPassword !== "") {
        profileChanges.newPassword = newPassword;
      }

      const result = await toast.promise(
        () => api.updateProfile(profileChanges),
        {
          loading: translations.feedback.working,
          success: translations.accountSaved,
          error: (error) => errorText(error, translations),
        },
      );
      onUpdated(result.user);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      /* the toast shows why; the form stays open */
    } finally {
      setIsSaving(false);
    }
  }
  // UI and inline Tailwind styles
  return (
    <main className="pt-5 pb-0 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1100px]">
      <h2 className="text-xl font-extrabold [margin:var(--s2)_0_var(--s4)] leading-[1.3]">
        {translations.accountTitle}
      </h2>
      <form onSubmit={handleSubmit}>
        <fieldset disabled={isSaving} className="border-0 p-0 m-0 min-w-0">
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="account-name">
            {translations.name}
          </label>
          <input
            id="account-name"
            className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
            autoComplete="name"
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="account-email">
            {translations.email}
          </label>
          <input
            id="account-email"
            className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="account-current">
            {translations.currentPassword}
          </label>
          <input
            id="account-current"
            className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <p className="text-sm leading-[1.5] text-ink-soft mx-0 mt-2 mb-0">
            {translations.keepPassword}
          </p>
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="account-new">
            {translations.newPassword}
          </label>
          <input
            id="account-new"
            className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="account-repeat">
            {translations.repeatPassword}
          </label>
          <input
            id="account-repeat"
            className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
            type="password"
            autoComplete="new-password"
            required={!!newPassword}
            maxLength={128}
            value={confirmPassword}
            aria-invalid={Boolean(confirmPassword) && confirmPassword !== newPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          {Boolean(confirmPassword) && confirmPassword !== newPassword && (
            <p
              className="text-danger-ink text-sm font-bold [margin:6px_2px_0] flex items-center gap-1.5"
              role="alert"
            >
              <Icon name="error" size={14} />
              {translations.pwMismatch}
            </p>
          )}
          <div className="flex gap-2 items-center mt-3 [&>button:first-child]:shrink-0 [&>button:last-child]:flex-1 [&>button:last-child]:mt-0 max-md:in-data-[sheet]:sticky max-md:in-data-[sheet]:bottom-[calc(-1*var(--s4))] max-md:in-data-[sheet]:bg-surface max-md:in-data-[sheet]:pt-3 max-md:in-data-[sheet]:pb-[calc(var(--s3)+var(--safe-b))] max-md:in-data-[sheet]:-mb-4 max-md:in-data-[sheet]:[border-top:1px_solid_var(--line)] max-md:in-data-[sheet]:z-2">
            <button
              className="bg-transparent border-0 text-action font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default"
              type="button"
              onClick={goToFindPage}
            >
              <Icon name="cancel" />
              {translations.cancel}
            </button>
            <button
              className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-action text-white tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96 active:bg-action-dark shadow-[inset_0_-2px_0_rgba(0,0,0,.18)]"
              type="submit"
            >
              <Icon name="confirm" />
              {isSaving ? "…" : translations.saveBtn}
            </button>
          </div>
        </fieldset>
      </form>
    </main>
  );
}
