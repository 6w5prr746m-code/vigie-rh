"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toQuery, type Filters } from "@/lib/filters";

export default function ViewHeader({ title, sub, f, children }: { title: string; sub: string; f: Filters; children?: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState(f.q);
  const [railOpen, setRailOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => setQ(f.q), [f.q]);
  const onInput = (v: string) => {
    setQ(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => router.replace(`${path}${toQuery(f, { q: v, page: 1, fiche: null })}`, { scroll: false }), 250);
  };
  const toggleRail = () => {
    const rail = document.getElementById("rail");
    if (rail) rail.dataset.collapsed = String(railOpen);
    setRailOpen(!railOpen);
  };

  return (
    <div className="head">
      <div><h1>{title}</h1><p>{sub}</p></div>
      <form className="search" onSubmit={(e) => e.preventDefault()}>
        <button type="button" className="btn only-mobile" onClick={toggleRail}>{railOpen ? "Masquer" : "Afficher"} les filtres</button>
        <input type="search" placeholder="Rechercher une entreprise ou un SIREN" value={q} onChange={(e) => onInput(e.target.value)} aria-label="Rechercher une entreprise" />
        {children}
      </form>
    </div>
  );
}
