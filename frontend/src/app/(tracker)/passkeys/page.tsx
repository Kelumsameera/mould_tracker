"use client";
import { useApp } from "@/components/AppLayout";

import { useEffect, useState } from "react";
import {
  browserSupportsWebAuthn,
  startRegistration,
} from "@simplewebauthn/browser";
import { api, type PasskeyInfo } from "@/utils/api";
import { passkeyText, passkeyError } from "@/utils/passkeyText";

export default function PasskeysPage() {
  const { lang } = useApp();

  const passkeyLabels = passkeyText(lang);
  // Screen state
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [canUsePasskeys, setCanUsePasskeys] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // Effects: load data and update the screen
  useEffect(() => {
    setPassword("");
    setName("");
    setMessage("");
    setError("");
    setCanUsePasskeys(false);
    let cancelled = false;
    async function loadPasskeys() {
      try {
        const response = await api.passkeys();
        if (!cancelled) {
          setPasskeys(response.passkeys);
        }
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : String(error));
        }
      }
    }
    async function checkPasskeySupport() {
      if (!window.isSecureContext || !browserSupportsWebAuthn()) return;
      try {
        const response = await api.passkeyCapabilities();
        if (!cancelled) {
          setCanUsePasskeys(response.enabled);
        }
      } catch {
        // Keep registration disabled when support cannot be checked.
      }
    }
    loadPasskeys();
    checkPasskeySupport();
    return () => {
      cancelled = true;
    };
  }, []);

  // Button and form actions
  async function addPasskey() {
    setIsSaving(true);
    setMessage("");
    setError("");
    try {
      const { options } = await api.passkeyRegistrationOptions(
        password,
        name.trim(),
      );
      const response = await startRegistration({ optionsJSON: options });
      await api.passkeyRegistrationVerify(response);
      const savedPasskeys = await api.passkeys();
      setPasskeys(savedPasskeys.passkeys);
      setPassword("");
      setName("");
      setMessage(passkeyLabels.added);
    } catch (error) {
      setError(passkeyError(error, lang));
    } finally {
      setIsSaving(false);
    }
  }
  async function removePasskey(id: string) {
    setIsSaving(true);
    setMessage("");
    setError("");
    try {
      await api.removePasskey(id, password);
      setPasskeys((list) => list.filter((key) => key.id !== id));
      setPassword("");
      setMessage(passkeyLabels.removed);
    } catch (error) {
      setError(passkeyError(error, lang));
    } finally {
      setIsSaving(false);
    }
  }

  // UI and inline Tailwind styles
  return (
    <main className="pt-5 pb-0 pr-[calc(var(--s4)+var(--safe-r))] pl-[calc(var(--s4)+var(--safe-l))] md:pt-6 md:px-6 xl:pt-8 xl:px-8 max-w-[1100px]">
      <h2 className="text-xl font-extrabold [margin:var(--s2)_0_var(--s4)] leading-[1.3]">
        {passkeyLabels.title}
      </h2>
      <p>{passkeyLabels.description}</p>
      {!canUsePasskeys && (
        <p className="text-sm leading-[1.5] text-ink-soft mx-0 mt-2 mb-0">
          {passkeyLabels.https}
        </p>
      )}
      <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="passkey-password">
        {passkeyLabels.password}
      </label>
      <input
        id="passkey-password"
        className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
        type="password"
        autoComplete="current-password"
        disabled={isSaving}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink" htmlFor="passkey-name">
        {passkeyLabels.name}
      </label>
      <input
        id="passkey-name"
        className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
        maxLength={80}
        placeholder="My phone / Windows Hello"
        disabled={isSaving}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <button
        className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-action text-white tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96 active:bg-action-dark shadow-[inset_0_-2px_0_rgba(0,0,0,.18)]"
        disabled={isSaving || !canUsePasskeys || !password || !name.trim()}
        onClick={addPasskey}
      >
        {passkeyLabels.add}
      </button>
      {message && <p role="status">{message}</p>}
      {error && (
        <div
          className="mt-3 p-3 rounded-md bg-danger-bg text-danger-ink text-sm font-bold flex gap-2 items-start"
          role="alert"
        >
          {error}
        </div>
      )}
      <div className="flex flex-col">
        {!passkeys.length && <p>{passkeyLabels.empty}</p>}
        {passkeys.map((key) => (
          <div
            className="flex items-center gap-2 [padding:var(--s3)_0] [border-bottom:1px_solid_var(--line)] flex-wrap"
            key={key.id}
          >
            <div className="flex-1 min-w-[180px] flex flex-col text-md [&_small]:text-ink-soft [&_small]:overflow-hidden [&_small]:text-ellipsis">
              <b>{key.name}</b>
              <small>{new Date(key.createdAt).toLocaleDateString()}</small>
            </div>
            <button
              className="bg-transparent border-0 text-action font-extrabold text-sm min-h-tap px-2 py-0 cursor-pointer inline-flex items-center gap-1.5 disabled:text-ink-faint disabled:cursor-default"
              disabled={isSaving || !canUsePasskeys || !password}
              onClick={() => removePasskey(key.id)}
            >
              {passkeyLabels.remove}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
