"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { I18N, type Lang } from "@/utils/i18n";
import Icon from "@/components/Icon";
import { RAIL_HIDE, RAIL_ITEM } from "@/utils/helpers";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
const PwaContext = createContext<{
  prompt: InstallPrompt | null;
  installed: boolean;
  ios: boolean;
  clear: () => void;
}>({
  prompt: null,
  installed: false,
  ios: false,
  clear: () => {},
});

export default function PwaProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const update = () =>
      setInstalled(
        standalone.matches ||
          /ToolTrackerNative\//.test(navigator.userAgent) ||
          !!(navigator as Navigator & { standalone?: boolean }).standalone,
      );
    update();
    setIos(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const appInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    standalone.addEventListener("change", update);
    if (
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
      standalone.removeEventListener("change", update);
    };
  }, []);
  return (
    <PwaContext.Provider
      value={{ prompt, installed, ios, clear: () => setPrompt(null) }}
    >
      {children}
    </PwaContext.Provider>
  );
}

export function PwaInstallButton({
  lang,
  className = "relative flex items-center gap-3 w-full min-h-tap px-3 py-0 border-0 rounded-sm bg-transparent text-[#b9c5cd] text-[14.5px] font-medium text-left cursor-pointer whitespace-nowrap hover:bg-white/6 hover:text-white " + RAIL_ITEM,
}: {
  lang: Lang;
  className?: string;
}) {
  const { prompt, installed, ios, clear } = useContext(PwaContext);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  if (installed) return null;
  async function install() {
    if (!prompt) {
      setHelp((value) => !value);
      return;
    }
    setBusy(true);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      setHelp(true);
    } finally {
      clear();
      setBusy(false);
    }
  }
  const translations = I18N[lang].install;
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={install}
        title={translations.button}
        aria-label={translations.button}
      >
        <Icon name="install" size={20} />
        <span className={"overflow-hidden text-ellipsis " + RAIL_HIDE}>
          {translations.button}
        </span>
      </button>
      {help && (
        <div
          className={"text-sm [margin:var(--s2)_var(--s3)] text-[#C9D3DA] " + RAIL_HIDE}
          role="status"
        >
          <p>{ios ? translations.ios : translations.other}</p>
          <a
            className="text-inherit [text-decoration:underline] [text-underline-offset:3px]"
            href="/install.html"
          >
            {translations.guide}
          </a>
        </div>
      )}
    </>
  );
}
