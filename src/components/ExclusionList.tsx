"use client";
import { useTransition } from "react";
import { deleteExclusionRule } from "@/app/actions";

export default function ExclusionList({ rules }: { rules: { id: string; label: string; siren: string | null; matched: boolean }[] }) {
  const [pending, start] = useTransition();
  if (!rules.length) return <p className="sub">Aucune règle. Importez votre liste de clients avec le type « Liste d&apos;exclusion ».</p>;
  return (
    <details>
      <summary>{rules.length} règle{rules.length > 1 ? "s" : ""} · {rules.filter((r) => r.matched).length} appliquée{rules.filter((r) => r.matched).length > 1 ? "s" : ""} à des comptes en base</summary>
      <div style={{ maxHeight: 320, overflow: "auto", marginTop: 8 }}>
        {rules.map((r) => (
          <div key={r.id} className="toolrow">
            <span>{r.label}{r.siren && <span className="sub num"> · {r.siren}</span>}{!r.matched && <span className="sub"> · en attente</span>}</span>
            <button type="button" className="btn small" disabled={pending} onClick={() => start(() => deleteExclusionRule(r.id))}>Retirer</button>
          </div>
        ))}
      </div>
      <p className="sub">Retirer une règle n&apos;intègre pas le compte : utilisez « Réintégrer » dans le rail de filtres.</p>
    </details>
  );
}
