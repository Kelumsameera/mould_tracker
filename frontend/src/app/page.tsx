"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getLegacyDestination } from "@/utils/helpers";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getLegacyDestination(window.location.hash));
  }, [router]);

  return <div className="min-h-dvh grid place-items-center">…</div>;
}
