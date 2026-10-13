import Link from "next/link";
import { cells } from "@/lib/cells";

export default function Home() {
  return (
    <>
      <p className="eyebrow">ENSIAS Founders</p>
      <h1>Files d&apos;attente des stands</h1>
      <ul className="cells">
        {cells.map((c) => (
          <li key={c.slug}>
            <Link href={`/c/${c.slug}`}>{c.name} →</Link>
          </li>
        ))}
      </ul>
    </>
  );
}
