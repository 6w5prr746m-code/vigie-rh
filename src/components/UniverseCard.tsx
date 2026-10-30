"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { UniverseReport } from "@/collect/univers";

const SECTION_LABEL: Record<string, string> = {
  A: "Agriculture", B: "Industries extractives", C: "Industrie manufacturière", D: "Énergie", E: "Eau, déchets", F: "Construction", G: "Commerce",
  H: "Transport", I: "Hébergement, restauration", J: "Information, communication", K: "Finance, assurance", L: "Immobilier", M: "Activités spécialisées",
  N: "Services administratifs", O: "Administration publique", P: "Enseignement", Q: "Santé, action sociale", R: "Arts, loisirs", S: "Autres services", T: "Ménages", U: "Extra-territorial",
};

export default function UniverseCard() {
  const router = useRouter();
  const [min, setMin] = useState(1000);
  const [pub, setPub] = useState(false);
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<{ counts: Record<string, number>; total: number } | null>(null);
  const [report, setReport] = useState<UniverseReport | null>(null);

  const call = async <T,>(label: string, fn: () => Promise<Response>): Promise<T | null> => {
    setBusy(label); setError(null);
    try {
      const res = await fn(); const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      return json as T;
    } catch (e) { setError((e as Error).message); return null; }
    finally { setBusy(null); }
  };
  const doEstimate = async () => setEstimate(await call("Estimation en cours (une requête par section NAF)…", () => fetch(`/api/univers?min=${min}&public=${pub ? 1 : 0}`)));
  const doImport = async () => {
    const r = await call<{ report: UniverseReport }>("Import en cours… (quelques minutes pour l'univers complet)", () =>
      fetch("/api/univers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ min, public: pub, limit: limit || undefined }) }));
    if (r) { setReport(r.report); router.refresh(); }
  };

  return (
    <section className="tablebox" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 className="rail-title">Univers cible · Recherche d&apos;entreprises (données publiques)</h2>
      <p className="sub" style={{ margin: 0 }}>Entreprises actives en France, filtrées sur la tranche d&apos;effectif INSEE. Les comptes déjà importés sont complétés (SIREN, NAF, tranche) sans doublon ; vos effectifs précis sont conservés.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label>Effectif minimum{" "}
          <select className="btn small" value={min} onChange={(e) => { setMin(Number(e.target.value)); setEstimate(null); }}>
            {[250, 500, 1000, 2000, 5000].map((v) => <option key={v} value={v}>{v.toLocaleString("fr-FR")} salariés</option>)}
          </select>
        </label>
        <label style={{ display: "flex", gap: 6 }}><input type="checkbox" checked={pub} onChange={(e) => { setPub(e.target.checked); setEstimate(null); }} />Inclure le secteur public</label>
        <label>Limiter à{" "}<input className="btn small" style={{ width: 90 }} type="number" min={1} placeholder="tout" value={limit} onChange={(e) => setLimit(e.target.value)} /> entreprises</label>
      </div>
      <div className="actions">
        <button type="button" className="btn" disabled={!!busy} onClick={doEstimate}>Estimer</button>
        <button type="button" className="btn primary" disabled={!!busy} onClick={doImport}>{limit ? `Importer ${limit} entreprises (test)` : "Importer l'univers"}</button>
      </div>
      {busy && <p className="sub">{busy}</p>}
      {error && <p style={{ color: "var(--t-dep)" }}>{error}</p>}
      {estimate && (
        <details open>
          <summary><b className="num">{estimate.total.toLocaleString("fr-FR")}</b> entreprises (avant retrait des entités publiques hors section O)</summary>
          <div className="facts" style={{ marginTop: 8 }}>
            {Object.entries(estimate.counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
              <div key={s} className="fact"><div className="k">{s} · {SECTION_LABEL[s]}</div><div className="v num">{n.toLocaleString("fr-FR")}</div></div>
            ))}
          </div>
        </details>
      )}
      {report && (
        <p>Import terminé : {report.fetched} lues · {report.created} créées · {report.updated} mises à jour · {report.linkedBySiren} complétées (SIREN ajouté) · {report.skippedPublic} publiques écartées · {report.customers} clients exclus.</p>
      )}
    </section>
  );
}
