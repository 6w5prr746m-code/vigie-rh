"use client";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { FONCTIONS, OUTILS, SECTEURS, STRUCTURES, THEMES, TRANCHES, trancheLabel } from "@/lib/referentiels";
import { toQuery, type Filters } from "@/lib/filters";
import { reincludeCompany } from "@/app/actions";
import { toast } from "./Toaster";

type ListKey = "themes" | "fns" | "secteurs" | "structs" | "pub" | "outils";

export default function FilterRail({ f, mode, excluded }: { f: Filters; mode: "signaux" | "comptes" | "contacts"; excluded: { id: string; name: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const go = (over: Partial<Filters>) => start(() => router.replace(`${path}${toQuery(f, { ...over, page: 1, fiche: null })}`, { scroll: false }));

  const toggle = (k: ListKey, v: string) => {
    const cur = f[k];
    go({ [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } as Partial<Filters>);
  };
  const toggleTranche = (i: number) => go({ tranches: f.tranches.includes(i) ? f.tranches.filter((x) => x !== i) : [...f.tranches, i] });
  const reset = () =>
    go({ q: "", period: "all", types: [], themes: [], fns: [], secteurs: [], tranches: [], structs: [], pub: [], foreign: false, outils: [], rec: "any" });

  const Cb = ({ k, v, label }: { k: ListKey; v: string; label: string }) => (
    <label key={v}><input type="checkbox" checked={f[k].includes(v)} onChange={() => toggle(k, v)} /><span>{label}</span></label>
  );
  const Grouped = ({ k, dict }: { k: ListKey; dict: Record<string, string[]> }) =>
    Object.entries(dict).flatMap(([g, items]) => [
      <div key={g} className="grp">{g}</div>,
      ...items.map((v) => Cb({ k, v, label: v })),
    ]);

  return (
    <aside className="rail" id="rail" aria-label="Filtres" data-collapsed="true" aria-busy={pending}>
      <h2>Filtres <button type="button" className="reset" onClick={reset}>Tout effacer</button></h2>
      {mode === "signaux" ? (
        <>
          <details className="fg" open><summary>Période</summary>
            <Seg value={f.period} options={[["7", "7 j"], ["30", "30 j"], ["90", "3 mois"], ["all", "Tout"]]} onPick={(v) => go({ period: v })} />
          </details>
          <Group title="Thèmes d'actualité" n={f.themes.length}>{Grouped({ k: "themes", dict: THEMES })}</Group>
          <Group title="Fonctions (emploi, mouvements)" n={f.fns.length}>{Grouped({ k: "fns", dict: FONCTIONS })}</Group>
        </>
      ) : (
        <>
          <details className="fg" open><summary>Signaux récents</summary>
            <Seg value={f.rec} options={[["any", "Peu importe"], ["7", "7 j"], ["30", "30 j"], ["90", "3 mois"], ["some", "Au moins un"]]} onPick={(v) => go({ rec: v })} />
          </details>
          {mode === "contacts" && <Group title="Fonctions" n={f.fns.length}>{Grouped({ k: "fns", dict: FONCTIONS })}</Group>}
          <Group title="Outils en place" n={f.outils.length}>{Grouped({ k: "outils", dict: OUTILS })}</Group>
        </>
      )}
      <Group title="Secteur" n={f.secteurs.length}>{SECTEURS.map((s) => Cb({ k: "secteurs", v: s, label: s }))}</Group>
      <Group title="Effectif de l'entité" n={f.tranches.length}>
        {TRANCHES.map((t, i) => (
          <label key={i}><input type="checkbox" checked={f.tranches.includes(i)} onChange={() => toggleTranche(i)} /><span>{trancheLabel(t)}</span></label>
        ))}
      </Group>
      <Group title="Structure" n={f.structs.length}>{Object.entries(STRUCTURES).map(([k, l]) => Cb({ k: "structs", v: k, label: l }))}</Group>
      <Group title="Public / privé" n={f.pub.length + (f.foreign ? 1 : 0)}>
        {Cb({ k: "pub", v: "non", label: "Privé" })}
        {Cb({ k: "pub", v: "oui", label: "Public" })}
        <label><input type="checkbox" checked={f.foreign} onChange={() => go({ foreign: !f.foreign })} /><span>Rattaché à un groupe étranger</span></label>
      </Group>
      {excluded.length > 0 && (
        <Group title="Comptes exclus" n={excluded.length}>
          {excluded.map((c) => (
            <label key={c.id}>
              <button type="button" className="btn small" onClick={() => start(async () => { await reincludeCompany(c.id); toast("Compte réintégré"); })}>Réintégrer</button>
              <span>{c.name}</span>
            </label>
          ))}
        </Group>
      )}
    </aside>
  );
}

function Group({ title, n, open, children }: { title: string; n: number; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="fg" open={open || n > 0 || undefined}>
      <summary>{title}{n > 0 && <span className="cnt num">{n}</span>}</summary>
      <div className="opts">{children}</div>
    </details>
  );
}

function Seg({ value, options, onPick }: { value: string; options: [string, string][]; onPick: (v: string) => void }) {
  return <div className="seg">{options.map(([k, l]) => <button key={k} type="button" aria-pressed={value === k} onClick={() => onPick(k)}>{l}</button>)}</div>;
}
