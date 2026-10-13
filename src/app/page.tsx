"use client";

import Link from "next/link";
import { type CellOverview, type TicketState, ahead, ticketState, useAllQueues } from "@/lib/all-queues";

/** Ordre d'affichage des tickets : le plus urgent d'abord. */
const URGENCY: Record<TicketState, number> = { turn: 0, next: 1, wait: 2, passed: 3 };

/** Vue multi-files : l'état de tous les stands sur un seul écran. */
export default function Overview() {
  const { overview, loaded, offline } = useAllQueues();

  const withTicket = overview
    .filter((c) => c.ticket && c.queue)
    .sort(
      (a, b) =>
        URGENCY[ticketState(a.ticket!, a.queue!.now_serving)] - URGENCY[ticketState(b.ticket!, b.queue!.now_serving)] ||
        ahead(a.ticket!, a.queue!.now_serving) - ahead(b.ticket!, b.queue!.now_serving),
    );
  const others = overview.filter((c) => !c.ticket || !c.queue);

  return (
    <div className="overview">
      <p className="eyebrow">ENSIAS Founders</p>
      <h1>Files d&apos;attente des stands</h1>

      {offline && <p className="offline">Connexion perdue — l&apos;affichage n&apos;est peut-être pas à jour.</p>}

      {withTicket.length > 0 && (
        <>
          <h2 className="section">Mes tickets</h2>
          <div className="grid">
            {withTicket.map((c) => (
              <TicketCard key={c.slug} cell={c} />
            ))}
          </div>
        </>
      )}

      <h2 className="section">{withTicket.length > 0 ? "Autres stands" : "Stands"}</h2>
      <div className="grid">
        {others.map((c) => (
          <Link key={c.slug} href={`/c/${c.slug}`} className="tile">
            <span className="tile-name">{c.name}</span>
            <span className="tile-stats">
              <span>
                <span className="label">Appelé</span>
                <strong>{c.queue ? c.queue.now_serving || "—" : loaded ? "—" : "…"}</strong>
              </span>
              <span>
                <span className="label">En attente</span>
                <strong>{c.queue ? c.queue.last_issued - c.queue.now_serving : loaded ? "—" : "…"}</strong>
              </span>
            </span>
            <span className="tile-cta">Prendre un numéro →</span>
          </Link>
        ))}
      </div>

      <p className="hint">L&apos;affichage se met à jour automatiquement.</p>
    </div>
  );
}

function TicketCard({ cell }: { cell: CellOverview }) {
  const ticket = cell.ticket!;
  const nowServing = cell.queue!.now_serving;
  const state = ticketState(ticket, nowServing);
  const n = ahead(ticket, nowServing);
  const message = {
    turn: "C'est votre tour !",
    next: "Vous êtes le prochain",
    wait: `${n} personne${n > 1 ? "s" : ""} avant vous`,
    passed: "Votre numéro est passé",
  }[state];

  return (
    <Link href={`/c/${cell.slug}`} className={`tile tile-${state}`}>
      <span className="tile-name">{cell.name}</span>
      <span className="tile-stats">
        <span>
          <span className="label">Votre n°</span>
          <strong className="gold">{ticket}</strong>
        </span>
        <span>
          <span className="label">Appelé</span>
          <strong>{nowServing || "—"}</strong>
        </span>
      </span>
      <span className="tile-status">{message}</span>
    </Link>
  );
}
