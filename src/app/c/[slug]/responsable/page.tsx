"use client";

import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cellName } from "@/lib/cells";
import { storage, supabase, useQueue } from "@/lib/queue";

type RpcResult = { ok: boolean; error?: "pin" | "locked" };

const ERRORS: Record<string, string> = {
  pin: "PIN incorrect.",
  locked: "Trop d'essais. Réessayez dans 30 secondes.",
  network: "Erreur réseau. Vérifiez la connexion et réessayez.",
};

export default function ManagerPage() {
  const { slug } = useParams<{ slug: string }>();
  const name = cellName(slug);
  const { queue, offline, refresh } = useQueue(slug);
  const key = `pin:${slug}`;
  const [pin, setPin] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => setPin(storage.get(key)), [key]);

  if (!name) notFound();

  async function rpc(fn: string, p: string): Promise<RpcResult | null> {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc(fn, { p_slug: slug, p_pin: p });
    setBusy(false);
    if (error || !data) {
      setError(ERRORS.network);
      return null;
    }
    const res = data as RpcResult;
    if (!res.ok) {
      setError(ERRORS[res.error ?? "pin"]);
      // PIN mémorisé devenu invalide → retour à l'écran de saisie.
      if (res.error === "pin" && fn !== "verify_queue_pin") logout();
    }
    return res;
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const res = await rpc("verify_queue_pin", input);
    if (res?.ok) {
      storage.set(key, input);
      setPin(input);
      setInput("");
    }
  }

  function logout() {
    storage.remove(key);
    setPin(null);
  }

  async function callNext() {
    if (pin && (await rpc("call_next", pin))?.ok) refresh();
  }

  async function reset() {
    setConfirmReset(false);
    if (pin && (await rpc("reset_queue", pin))?.ok) refresh();
  }

  if (!pin) {
    return (
      <>
        <p className="eyebrow">Responsable · {name}</p>
        <h1>Accès responsable</h1>
        <form onSubmit={login}>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="PIN"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy || input.length !== 4}>
            {busy ? "…" : "Entrer"}
          </button>
        </form>
      </>
    );
  }

  const waiting = queue ? queue.last_issued - queue.now_serving : 0;

  return (
    <>
      <p className="eyebrow">Responsable · File d&apos;attente</p>
      <h1>{name}</h1>

      {offline && <p className="offline">Connexion perdue — l&apos;affichage n&apos;est peut-être pas à jour.</p>}

      <div className="card">
        <p className="label">Numéro appelé</p>
        <p className="big gold">{queue ? queue.now_serving || "—" : "…"}</p>
      </div>
      <div className="row">
        <div className="card">
          <p className="label">En attente</p>
          <p className="mid">{queue ? waiting : "…"}</p>
        </div>
        <div className="card">
          <p className="label">Tickets distribués</p>
          <p className="mid">{queue ? queue.last_issued : "…"}</p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="stack">
        <button onClick={callNext} disabled={busy || !queue || waiting === 0}>
          {waiting === 0 ? "Personne en attente" : `Appeler le n° ${queue!.now_serving + 1}`}
        </button>

        {confirmReset ? (
          <div className="card stack">
            <p className="label">Remettre la file à zéro ? Tous les tickets en cours seront annulés.</p>
            <button className="danger" onClick={reset} disabled={busy}>Oui, remettre à zéro</button>
            <button className="ghost" onClick={() => setConfirmReset(false)}>Annuler</button>
          </div>
        ) : (
          <button className="ghost" onClick={() => setConfirmReset(true)}>Remettre la file à zéro</button>
        )}
        <button className="ghost" onClick={logout}>Se déconnecter</button>
      </div>
    </>
  );
}
