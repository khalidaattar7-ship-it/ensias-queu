"use client";

import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

export type Queue = { last_issued: number; now_serving: number; epoch: number };

/** Intervalle de rafraîchissement de l'affichage. */
const POLL_MS = 4000;

/** État de la file d'une cellule, relu toutes les 4 s et au retour sur l'onglet. */
export function useQueue(slug: string) {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("queues")
      .select("last_issued, now_serving, epoch")
      .eq("cell_slug", slug)
      .maybeSingle();
    setOffline(Boolean(error));
    if (data) setQueue(data);
  }, [slug]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { queue, offline, refresh };
}

/** localStorage peut être indisponible (navigation privée stricte) : on ne plante jamais. */
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};
