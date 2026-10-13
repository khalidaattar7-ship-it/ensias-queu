/** Cellules du club (mêmes slugs que la table `queues`). */
export const cells = [
  { slug: "incubation-sponsoring", name: "Incubation & Sponsoring" },
  { slug: "design", name: "Design" },
  { slug: "media", name: "Media" },
  { slug: "training", name: "Training" },
  { slug: "event", name: "Event" },
] as const;

export const cellName = (slug: string) => cells.find((c) => c.slug === slug)?.name;
