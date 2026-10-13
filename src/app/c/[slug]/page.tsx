"use client";

import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CellSwitcher } from "@/components/CellSwitcher";
import { cellName } from "@/lib/cells";
import { storage, supabase, useQueue } from "@/lib/queue";

type Ticket = { ticket: number; epoch: number };

export default function StudentPage() {
  const { slug } = useParams<{ slug: string }>();
  const name = cellName(slug);
  const { queue, offline, refresh } = useQueue(slug);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [taking, setTaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = `ticket:${slug}`;

  // Ticket mémorisé sur cet appareil.
  useEffect(() => {
    const raw = storage.get(key);
    if (raw) {
      try {
        setTicket(JSON.parse(raw));
      } catch {
        storage.remove(key);
      }
    }
  }, [key]);

  // File remise à zéro par le responsable : l'ancien ticket n'a plus de sens.
  useEffect(() => {
    if (ticket && queue && ticket.epoch !== queue.epoch) {
      storage.remove(key);
      setTicket(null);
    }
  }, [ticket, queue, key]);

  if (!name) notFound();

  async function take() {
    setTaking(true);
    setError(null);
    const { data, error } = await supabase.rpc("take_ticket", { p_slug: slug });
    setTaking(false);
    if (error || !data) {
      setError("Impossible de prendre un numéro. Vérifiez votre connexion et réessayez.");
      return;
    }
    storage.set(key, JSON.stringify(data));
    setTicket(data as Ticket);
    refresh();
  }

  function drop() {
    storage.remove(key);
    setTicket(null);
  }

  const waiting = queue ? queue.last_issued - queue.now_serving : null;

  return (
    <>
      <CellSwitcher current={slug} />
      <p className="eyebrow">Stand · File d&apos;attente</p>
      <h1>{name}</h1>

      {offline && <p className="offline">Connexion perdue — l&apos;affichage n&apos;est peut-être pas à jour.</p>}

      {ticket && queue && <TicketStatus ticket={ticket.ticket} nowServing={queue.now_serving} />}

      <div className="row">
        {ticket && (
          <div className="card">
            <p className="label">Votre numéro</p>
            <p className="big gold">{ticket.ticket}</p>
          </div>
        )}
        <div className="card">
          <p className="label">Numéro appelé</p>
          <p className="big">{queue ? queue.now_serving || "—" : "…"}</p>
        </div>
      </div>

      {!ticket && (
        <div className="stack">
          <div className="card">
            <p className="label">Personnes en attente</p>
            <p className="mid">{waiting ?? "…"}</p>
          </div>
          {error && <p className="error">{error}</p>}
          <button onClick={take} disabled={taking || !queue}>
            {taking ? "…" : "Prendre un numéro"}
          </button>
          <p className="hint">Un seul numéro par personne. Gardez cette page ouverte ou faites une capture d&apos;écran.</p>
        </div>
      )}

      {ticket && queue && ticket.ticket < queue.now_serving && (
        <button onClick={drop}>Reprendre un numéro</button>
      )}

      <p className="hint">L&apos;affichage se met à jour automatiquement.</p>
    </>
  );
}

function TicketStatus({ ticket, nowServing }: { ticket: number; nowServing: number }) {
  if (ticket === nowServing) {
    return <div className="status turn">C&apos;est votre tour ! Présentez-vous au stand.</div>;
  }
  if (ticket < nowServing) {
    return <div className="status passed">Votre numéro est passé.</div>;
  }
  const ahead = ticket - nowServing - 1;
  if (ahead === 0) {
    return <div className="status next">Vous êtes le prochain — rapprochez-vous du stand.</div>;
  }
  return (
    <div className="status wait">
      {ahead} personne{ahead > 1 ? "s" : ""} avant vous. Vous pouvez visiter d&apos;autres stands.
    </div>
  );
}
