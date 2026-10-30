"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { addCompanyBySiren, addCompanyManual } from "@/app/actions";
import { toast } from "./Toaster";

type Hit = { siren: string; name: string; sector: string | null; city: string | null; headcount: number | null; known: boolean };

export default function AddCompany() {
  const router = useRouter();
  const path = usePathname();
  const dlg = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (q.trim().length < 3) { setHits([]); return; }
    const t = setTimeout(async () => {
      setError(null);
      const res = await fetch(`/api/entreprises/recherche?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error); setHits([]); } else setHits(json.results);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const done = (id?: string, err?: string) => {
    if (err) return toast(err);
    dlg.current?.close(); setQ(""); setHits([]);
    toast("Entreprise ajoutée");
    if (id) router.push(`${path}?fiche=${id}`, { scroll: false });
  };

  return (
    <>
      <button type="button" className="btn" onClick={() => dlg.current?.showModal()}>+ Ajouter</button>
      <dialog ref={dlg} className="dialog" aria-labelledby="addTitle">
        <div className="dhead"><h2 id="addTitle">Ajouter une entreprise</h2><button type="button" className="btn small" onClick={() => dlg.current?.close()}>Fermer</button></div>
        <input autoFocus type="search" placeholder="Nom ou SIREN" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Nom ou SIREN" />
        {error && <p className="sub" style={{ color: "var(--t-dep)" }}>Recherche indisponible : {error}</p>}
        <div>
          {hits.map((h) => (
            <div key={h.siren} className="toolrow">
              <span><b>{h.name}</b><br /><span className="sub">{[h.siren.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3"), h.sector, h.city, h.headcount ? `≥ ${h.headcount.toLocaleString("fr-FR")} sal.` : null].filter(Boolean).join(" · ")}</span></span>
              <button type="button" className="btn small" disabled={pending} onClick={() => start(async () => { const r = await addCompanyBySiren(h.siren); done(r.id, r.error); })}>{h.known ? "Mettre à jour" : "Ajouter"}</button>
            </div>
          ))}
        </div>
        {q.trim().length >= 2 && (
          <p className="sub">Introuvable ? <button type="button" className="reset" style={{ background: "none", border: 0, color: "var(--accent)", padding: 0 }} disabled={pending}
            onClick={() => start(async () => { const r = await addCompanyManual(q); done(r.id, r.error); })}>Créer « {q.trim()} » sans SIREN</button></p>
        )}
      </dialog>
    </>
  );
}
