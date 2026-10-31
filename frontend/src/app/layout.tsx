// Fonts bundled with the app (no CDN on the LAN): Barlow for UI, Barlow Semi Condensed for headings and Tool IDs.
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/barlow-semi-condensed/600.css";
import "@fontsource/barlow-semi-condensed/700.css";
import "@fontsource/noto-sans-sinhala/400.css";
import "@fontsource/noto-sans-sinhala/600.css";
import "@fontsource/noto-sans-sinhala/700.css";
import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import PwaProvider from "@/providers/PwaProvider";
import { ConfirmProvider } from "@/components/ConfirmHost";
import Script from "next/script";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Mould Tracker",
  description:
    "Find any mould: machine, production floor, workshop or Mould Room rack",
  manifest: "/manifest.webmanifest",
  applicationName: "Mould Tracker",
  appleWebApp: {
    capable: true,
    title: "Mould Tracker",
    statusBarStyle: "default",
  },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1B2B35",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('mould-tracker-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}`,
          }}
        />
        <PwaProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </PwaProvider>
        <Toaster
          position="bottom-center"
          containerClassName="bottom-[calc(var(--nav-h)+var(--safe-b)+12px)]! md:bottom-5!"
          toastOptions={{
            className: "font-[inherit] font-bold text-sm max-w-[min(92vw,480px)] bg-surface! text-ink! border border-solid border-line",
            duration: 3500,
            error: { duration: 6000 },
          }}
        />
      </body>
    </html>
  );
}
