"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { cells } from "@/lib/cells";

/** Un QR par cellule, vers /c/[slug] sur le domaine courant. Imprimer avec Ctrl+P (un par page). */
export default function QrPage() {
  const [codes, setCodes] = useState<{ slug: string; name: string; url: string; svg: string }[]>([]);

  useEffect(() => {
    const origin = window.location.origin;
    Promise.all(
      cells.map(async (c) => {
        const url = `${origin}/c/${c.slug}`;
        const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
        return { ...c, url, svg };
      }),
    ).then(setCodes);
  }, []);

  return (
    <div className="qr-sheet">
      {codes.map((c) => (
        <section key={c.slug} className="qr-page">
          <p className="qr-eyebrow">ENSIAS Founders · File d&apos;attente</p>
          <h2>{c.name}</h2>
          <div className="qr" dangerouslySetInnerHTML={{ __html: c.svg }} />
          <p className="qr-cta">Scannez pour prendre un numéro</p>
          <p className="qr-url">{c.url}</p>
        </section>
      ))}
    </div>
  );
}
