"use client";
import { useEffect, useState, type FormEvent } from "react";
import { I18N, type Lang } from "@/utils/i18n";
import { api } from "@/utils/api";
import { useRouter } from "next/navigation";
import { PAGE_PATHS } from "@/utils/helpers";
import { errorText } from "@/utils/format";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { passkeyText, passkeyError } from "@/utils/passkeyText";
import { PwaInstallButton } from "@/providers/PwaProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const [destination, setDestination] = useState("/find");
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const translations = I18N[lang];
  // Screen state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const passkeyLabels = passkeyText(lang);
  // Read the saved language and the requested page when opening /login.
  useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem("mould-tracker-lang");
      if (savedLanguage === "en" || savedLanguage === "si") {
        setLang(savedLanguage);
      }
    } catch {
      // Use English when browser storage is unavailable.
    }

    let nextPage = "/find";
    const requestedPage = new URLSearchParams(window.location.search).get("next");
    if (requestedPage) {
      try {
        const nextUrl = new URL(requestedPage, window.location.origin);
        const isLocalPage = nextUrl.origin === window.location.origin;
        const isTrackerPage = Object.values(PAGE_PATHS).some((path) => path === nextUrl.pathname);
        if (isLocalPage && isTrackerPage) {
          nextPage = nextUrl.pathname + nextUrl.search;
        }
      } catch {
        // Invalid return links open the Find page.
      }
    }
    setDestination(nextPage);

    async function checkSession() {
      try {
        await api.me();
        router.replace(nextPage);
      } catch {
        setCheckingSession(false);
      }
    }
    checkSession();
  }, [router]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Effects: load data and update the screen
  useEffect(() => {
    async function checkPasskeySupport() {
      if (!window.isSecureContext || !browserSupportsWebAuthn()) return;
      try {
        const response = await api.passkeyCapabilities();
        setPasskeyAvailable(response.enabled);
      } catch {
        // Password login remains available if passkeys cannot be checked.
      }
    }
    checkPasskeySupport();
  }, []);

  // Button and form actions
  function changeLanguage(language: Lang) {
    setLang(language);
    try {
      localStorage.setItem("mould-tracker-lang", language);
    } catch {
      // The selected language still works for this visit.
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.login(email, password);
      router.replace(destination);
    } catch (error) {
      setError(errorText(error, translations));
    } finally {
      setBusy(false);
    }
  }

  async function loginWithPasskey() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { options } = await api.passkeyLoginOptions();
      const credential = await startAuthentication({ optionsJSON: options });
      await api.passkeyLoginVerify(credential);
      router.replace(destination);
    } catch (error) {
      setError(passkeyError(error, lang));
    } finally {
      setBusy(false);
    }
  }

  if (checkingSession) {
    return <div className="min-h-dvh grid place-items-center">…</div>;
  }

  // UI and inline Tailwind styles
  return (
    <div className="min-h-dvh grid place-items-center p-5 bg-brand [background:radial-gradient(circle_at_1px_1px,rgba(255,255,255,.05)_1px,transparent_0)_0_0/22px_22px,var(--brand)]">
      <form onSubmit={submit} className="flex w-full max-w-[420px] flex-col rounded-xl [border-top:4px_solid_var(--accent)] bg-surface p-6 shadow-panel">
        <div className="flex items-center justify-end gap-3 mb-4">
          <ThemeToggle translations={translations} />
          <div className="flex bg-surface-3 rounded-md p-[3px] shrink-0 m-0 w-max">
            <button
              type="button"
              className={
                "border-0 text-xs font-extrabold min-w-10 min-h-9 px-2 py-0 rounded-[9px] cursor-pointer " +
                (lang === "en" ? "bg-ink text-surface" : "bg-transparent text-ink-soft")
              }
              onClick={() => changeLanguage("en")}
            >
              EN
            </button>
            <button
              type="button"
              className={
                "border-0 text-xs font-extrabold min-w-10 min-h-9 px-2 py-0 rounded-[9px] cursor-pointer " +
                (lang === "si" ? "bg-ink text-surface" : "bg-transparent text-ink-soft")
              }
              onClick={() => changeLanguage("si")}
            >
              සිං
            </button>
          </div>
        </div>
        <h1 className="text-[30px] font-bold">{translations.brandTitle}</h1>
        <p className="mt-1 mb-2 text-md text-ink-soft">{translations.loginSub}</p>
        <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.email}</label>
        <input
          className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label className="block mt-4 mb-1.5 ml-0.5 text-sm font-semibold text-ink">{translations.password}</label>
        <input
          className="w-full min-h-12 p-3 rounded-sm border-[1.5px] border-solid border-line [font-size:16px] bg-surface-2 text-ink focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(245,184,0,.35)] aria-[invalid=true]:border-danger [&:is(textarea)]:resize-y [&:is(textarea)]:min-h-18"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && (
          <div
            className="mt-3 p-3 rounded-md bg-danger-bg text-danger-ink text-sm font-bold flex gap-2 items-start"
            role="alert"
          >
            {error}
          </div>
        )}
        <button
          className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-action text-white tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96 active:bg-action-dark shadow-[inset_0_-2px_0_rgba(0,0,0,.18)]"
          disabled={busy}
        >
          {busy ? translations.signingIn : translations.signIn}
        </button>
        <button
          type="button"
          className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-surface-3 text-ink border-[1.5px] border-solid border-line tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96"
          disabled={busy || !passkeyAvailable}
          onClick={loginWithPasskey}
        >
          {passkeyLabels.login}
        </button>
        <p className="text-md leading-[1.5] text-ink-soft mx-0 mt-1 mb-2">
          {passkeyAvailable ? passkeyLabels.description : passkeyLabels.https}
        </p>
        <PwaInstallButton
          lang={lang}
          className="w-full min-h-12 px-4 py-3 rounded-md border-0 text-md font-semibold cursor-pointer mt-3 inline-flex items-center justify-center gap-2 [transition:filter_var(--fast),background_var(--fast)] bg-surface-3 text-ink border-[1.5px] border-solid border-line tracking-[.1px] disabled:opacity-50 disabled:cursor-default [@media(hover:hover)]:enabled:hover:brightness-96"
        />
      </form>
    </div>
  );
}
