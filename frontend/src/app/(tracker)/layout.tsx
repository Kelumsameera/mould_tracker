import { Suspense, type ReactNode } from "react";
import AppLayout from "@/components/AppLayout";

export default function TrackerLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={<div className="min-h-dvh grid place-items-center">…</div>}
    >
      <AppLayout>{children}</AppLayout>
    </Suspense>
  );
}
