import Link from "next/link";
import { RIVALS, SIGNAL_TYPES, STRUCTURES, type SignalType } from "@/lib/referentiels";
import { toQuery, type Filters } from "@/lib/filters";
import { fmt } from "@/lib/format";

export const Pill = ({ type }: { type: string }) => {
  const t = SIGNAL_TYPES[type as SignalType];
  return t ? <span className={`pill ${t.c}`}>{t.l}</span> : null;
};

export const ScoreCell = ({ total }: { total: number }) => (
  <span className="score">
    <span className="meter"><span style={{ width: `${total}%` }} /></span>
    <span className="num">{total}</span>
  </span>
);

export const ToolsCell = ({ tools }: { tools: { tool: string }[] }) => {
  if (!tools.length) return <span className="sub">Non identifiés</span>;
  return (
    <>
      {tools.slice(0, 3).map((t) => <span key={t.tool} className={`tool ${RIVALS.has(t.tool) ? "rival" : ""}`}>{t.tool}</span>)}
      {tools.length > 3 && <span className="sub">+{tools.length - 3}</span>}
    </>
  );
};

export const structLine = (c: { structure: string; subsidiariesCount: number }) =>
  c.structure === "mere" && c.subsidiariesCount ? `Maison mère, ${c.subsidiariesCount} filiales` : STRUCTURES[c.structure] ?? c.structure;

/** Lien qui ouvre la fiche entreprise en tiroir, en gardant les filtres courants. */
export const CompanyLink = ({ f, path, id, name }: { f: Filters; path: string; id: string; name: string }) => (
  <Link className="co" href={`${path}${toQuery(f, { fiche: id })}`} scroll={false}>{name}</Link>
);

export function SortTh({ f, path, k, label }: { f: Filters; path: string; k: string; label: string }) {
  const active = f.sort === k;
  const dir = active ? (f.dir === 1 ? -1 : 1) : -1;
  return (
    <th data-sort={k} aria-sort={active ? (f.dir === 1 ? "ascending" : "descending") : undefined}>
      <Link href={`${path}${toQuery(f, { sort: k, dir: dir as 1 | -1, page: 1 })}`} scroll={false} style={{ color: "inherit", textDecoration: "none" }}>
        {label}{active ? (f.dir === 1 ? " ↑" : " ↓") : ""}
      </Link>
    </th>
  );
}

export function Pager({ f, path, total }: { f: Filters; path: string; total: number }) {
  const pages = Math.max(1, Math.ceil(total / f.per));
  const page = Math.min(f.page, pages);
  const a = (page - 1) * f.per + 1, b = Math.min(total, page * f.per);
  return (
    <div className="pager">
      <span className="num">{total ? `${fmt(a)} à ${fmt(b)} sur ${fmt(total)}` : "0 résultat"} · aucune limite de consultation</span>
      <div className="btns">
        {page > 1 ? <Link className="btn small" href={`${path}${toQuery(f, { page: page - 1 })}`}>Précédent</Link> : <button className="btn small" disabled>Précédent</button>}
        <span className="num" style={{ alignSelf: "center" }}>{page} / {fmt(pages)}</span>
        {page < pages ? <Link className="btn small" href={`${path}${toQuery(f, { page: page + 1 })}`}>Suivant</Link> : <button className="btn small" disabled>Suivant</button>}
      </div>
    </div>
  );
}
