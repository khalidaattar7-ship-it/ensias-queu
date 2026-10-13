"use client";

import Link from "next/link";
import { ahead, ticketState, useAllQueues } from "@/lib/all-queues";

/** Bandeau des stands : passer d'une file à l'autre sans « retour », avec l'état de chaque ticket. */
export function CellSwitcher({ current }: { current: string }) {
  const { overview } = useAllQueues();

  return (
    <nav className="switcher" aria-label="Stands">
      <Link href="/" className="chip chip-all">
        Toutes
      </Link>
      {overview.map((c) => {
        const state = c.ticket && c.queue ? ticketState(c.ticket, c.queue.now_serving) : null;
        const badge =
          !state || !c.ticket || !c.queue
            ? null
            : state === "turn"
              ? "À vous !"
              : state === "next"
                ? "Prochain"
                : state === "passed"
                  ? "Passé"
                  : `${ahead(c.ticket, c.queue.now_serving)} avant`;
        return (
          <Link
            key={c.slug}
            href={`/c/${c.slug}`}
            className={`chip${c.slug === current ? " chip-current" : ""}${state ? ` chip-${state}` : ""}`}
            aria-current={c.slug === current ? "page" : undefined}
          >
            {c.name}
            {badge && <span className="chip-badge">{badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
