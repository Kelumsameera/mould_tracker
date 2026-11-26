"use client";
import { refreshMs } from "@/utils/runtimeConfig";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppLayout";
import RackOverview from "@/components/RackOverview";
import { api } from "@/utils/api";
import { can } from "@/utils/permissions";
import { errorText } from "@/utils/format";
import type { Zone } from "@/utils/types";

export default function RacksPage() {
  const { translations: t, openMould, refreshKey, user } = useApp();
  const [zones, setZones] = useState<Zone[]>([]);
  const [waiting, setWaiting] = useState<{ id: string; toolId: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await api.racks();
      setZones(response.zones); setWaiting(response.awaitingRack); setLoaded(true); setError("");
    } catch (err) { setError(errorText(err, t)); }
  }, [t]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, refreshMs());
    return () => clearInterval(timer);
  }, [load, refreshKey]);
  return <RackOverview zones={zones} waiting={waiting} translations={t} error={error} loaded={loaded} onRetry={() => void load()} onOpenMould={can(user, "mould.view") ? openMould : undefined} />;
}
