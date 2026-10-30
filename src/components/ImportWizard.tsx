"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FIELDS, type ImportKind, type Mapping } from "@/lib/import/mapping";
import type { ImportReport } from "@/lib/import/run";

type Preview = { headers: string[]; mapping: Mapping; sample: Record<string, string>[]; rowCount: number };
const KINDS: [ImportKind, string, string][] = [
  ["entreprises", "Entreprises", "Export HubSpot « Entreprises » ou fichier maison. Les comptes en phase « Client » sont exclus automatiquement."],
  ["contacts", "Contacts", "Export HubSpot « Contacts » ou fichier maison. Un changement de poste ou d'entreprise crée un signal Arrivée / Départ."],
  ["exclusions", "Liste d'exclusion", "Vos clients signés : une colonne SIREN et / ou nom. Appliquée aussi aux comptes importés plus tard."],
];

export default function ImportWizard() {
  const router = useRouter();
  const [kind, setKind] = useState<ImportKind>("entreprises");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [createMissing, setCreateMissing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const post = async (mode: "preview" | "run", f: File, k: ImportKind) => {
    const fd = new FormData();
    fd.set("file", f); fd.set("kind", k); fd.set("mode", mode);
    fd.set("mapping", JSON.stringify(mapping)); fd.set("createMissing", createMissing ? "1" : "0");
    const res = await fetch("/api/import", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Erreur inconnue");
    return json;
  };
  const load = async (f: File | null, k: ImportKind) => {
    setFile(f); setPreview(null); setReport(null); setError(null);
    if (!f) return;
    setBusy(true);
    try { const p: Preview = await post("preview", f, k); setPreview(p); setMapping(p.mapping); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const run = async () => {
    if (!file) return;
    setBusy(true); setError(null);
    try { setReport((await post("run", file, kind)).report); router.refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <section className="tablebox" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 className="rail-title">Importer un fichier (CSV ou Excel .xlsx)</h2>
      <div className="types" role="group" aria-label="Type d'import">
        {KINDS.map(([k, l]) => (
          <button key={k} type="button" className="type-chip" aria-pressed={kind === k} onClick={() => { setKind(k); if (file) load(file, k); }}>{l}</button>
        ))}
      </div>
      <p className="sub" style={{ margin: 0 }}>{KINDS.find((k) => k[0] === kind)![2]}</p>
      <input type="file" accept=".csv,.txt,.xlsx" onChange={(e) => load(e.target.files?.[0] ?? null, kind)} />
      {busy && <p className="sub">Traitement en cours…</p>}
      {error && <p style={{ color: "var(--t-dep)" }}>{error}</p>}

      {preview && !report && (
        <>
          <p style={{ margin: 0 }}><b className="num">{preview.rowCount.toLocaleString("fr-FR")}</b> lignes. Vérifiez la correspondance des colonnes :</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 560 }}>
              <thead><tr><th>Champ Vigie RH</th><th>Colonne du fichier</th><th>Exemple (1re ligne)</th></tr></thead>
              <tbody>
                {FIELDS[kind].map((f) => (
                  <tr key={f.key}>
                    <td>{f.label}</td>
                    <td>
                      <select value={mapping[f.key] ?? ""} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || null })} className="btn small" style={{ maxWidth: 260 }}>
                        <option value="">— ignorer —</option>
                        {preview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </td>
                    <td className="sub">{mapping[f.key] ? preview.sample[0]?.[mapping[f.key]!] || "—" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {kind === "contacts" && (
            <label style={{ display: "flex", gap: 8 }}>
              <input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} />
              <span>Créer les entreprises introuvables (sinon les contacts concernés sont ignorés et listés)</span>
            </label>
          )}
          <div className="actions"><button type="button" className="btn primary" disabled={busy} onClick={run}>Importer {preview.rowCount.toLocaleString("fr-FR")} lignes</button></div>
        </>
      )}

      {report && (
        <div>
          <h3 className="rail-title">Import terminé</h3>
          <div className="facts" style={{ marginTop: 8 }}>
            {([["Créés", report.created], ["Mis à jour", report.updated], ["Ignorés", report.skipped], ["Entreprises créées", report.createdCompanies], ["Clients exclus", report.customers], ["Signaux détectés", report.signals]] as [string, number][])
              .filter(([l, v]) => v > 0 || l === "Créés" || l === "Mis à jour")
              .map(([l, v]) => <div key={l} className="fact"><div className="k">{l}</div><div className="v num">{v.toLocaleString("fr-FR")}</div></div>)}
            {report.kind === "exclusions" && <div className="fact"><div className="k">En attente (pas encore en base)</div><div className="v num">{report.pendingExclusions}</div></div>}
          </div>
          {report.issues.length > 0 && (
            <details style={{ marginTop: 10 }} open={report.issues.length <= 10}>
              <summary>{report.issues.length} remarque{report.issues.length > 1 ? "s" : ""}</summary>
              <ul className="sub">{report.issues.map((i, n) => <li key={n}>Ligne {i.row} : {i.message}</li>)}</ul>
            </details>
          )}
          <div className="actions" style={{ marginTop: 10 }}><button type="button" className="btn" onClick={() => load(null, kind)}>Importer un autre fichier</button></div>
        </div>
      )}
    </section>
  );
}
