"use client";

import { useCallback, useEffect, useState } from "react";
import { cells } from "@/lib/cells";
import { type Queue, storage, supabase } from "@/lib/queue";

/** Intervalle de rafraîchissement (identique à la page d'une cellule). */
const POLL_MS = 4000;

export type CellOverview = {
  slug: string;
  name: string;
  queue: Queue | null;
  /** Ticket de cet appareil, ignoré s'il date d'avant une remise à zéro. */
  ticket: number | null;
};

export type TicketState = "turn" | "next" | "wait" | "passed";

/** Lecture seule des tickets déjà pris (même clé `ticket:<slug>` que la page d'une cellule). */
function readTicket(slug: string): { ticket: number; epoch: number } | null {
  const raw = storage.get(`ticket:${slug}`);
  if (!raw) return null;
  try {
    const t = JSON.parse(raw);
    return typeof t?.ticket === "number" && typeof t?.epoch === "number" ? t : null;
  } catch {
    return null;
  }
}

/**
 * État de toutes les files en une seule requête, relu toutes les 4 s et au retour sur l'onglet.
 * Ne modifie jamais les tickets stockés : l'effacement reste du ressort de la page de la cellule.
 */
export function useAllQueues() {
  const [queues, setQueues] = useState<Record<string, Queue>>({});
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const [, setTick] = useState(0);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("queues")
      .select("cell_slug, last_issued, now_serving, epoch");
    setOffline(Boolean(error));
    if (data) {
      setQueues(Object.fromEntries(data.map(({ cell_slug, ...q }) => [cell_slug, q])));
      setLoaded(true);
    }
    // Relit aussi les tickets pris entre-temps (autre onglet, page d'une cellule).
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    const onStorage = () => setTick((n) => n + 1);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const overview: CellOverview[] = cells.map((c) => {
    const queue = queues[c.slug] ?? null;
    const t = readTicket(c.slug);
    const ticket = t && queue && t.epoch === queue.epoch ? t.ticket : null;
    return { slug: c.slug, name: c.name, queue, ticket };
  });

  return { overview, loaded, offline };
}

/** Même règle d'affichage que la page d'une cellule. */
export function ticketState(ticket: number, nowServing: number): TicketState {
  if (ticket === nowServing) return "turn";
  if (ticket < nowServing) return "passed";
  return ticket - nowServing - 1 === 0 ? "next" : "wait";
}

export const ahead = (ticket: number, nowServing: number) => Math.max(0, ticket - nowServing - 1);
