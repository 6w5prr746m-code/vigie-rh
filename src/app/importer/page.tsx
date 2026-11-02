import { prisma } from "@/lib/db";
import ImportWizard from "@/components/ImportWizard";
import UniverseCard from "@/components/UniverseCard";
import ExclusionList from "@/components/ExclusionList";

const KIND_LABEL: Record<string, string> = { entreprises: "Entreprises", contacts: "Contacts", exclusions: "Liste d'exclusion", univers: "Univers cible", "france-travail": "Offres France Travail", news: "Actualités" };

export default async function ImporterPage() {
  const lastCollect = Object.fromEntries((await prisma.setting.findMany({ where: { key: { startsWith: "lastCollect:" } } })).map((s) => [s.key.slice(12), new Date(JSON.parse(s.value))]));
  const [rules, runs, counts] = await Promise.all([
    prisma.exclusionRule.findMany({ orderBy: { label: "asc" } }),
    prisma.importRun.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
    Promise.all([prisma.company.count(), prisma.contact.count(), prisma.excluded.count({ where: { reason: "client" } })]),
  ]);
  const sirens = rules.map((r) => r.siren).filter((s): s is string => !!s);
  const keys = rules.map((r) => r.nameKey).filter((k): k is string => !!k);
  const matched = await prisma.company.findMany({ where: { OR: [{ siren: { in: sirens } }, { nameKey: { in: keys } }] }, select: { siren: true, nameKey: true } });
  const ms = new Set(matched.map((c) => c.siren)), mk = new Set(matched.map((c) => c.nameKey));

  return (
    <div className="wrap" style={{ gridTemplateColumns: "minmax(0,1fr) 320px" }}>
      <main>
        <div className="head"><div><h1>Importer mes données</h1><p>{counts[0].toLocaleString("fr-FR")} entreprises · {counts[1].toLocaleString("fr-FR")} contacts · {counts[2].toLocaleString("fr-FR")} clients exclus</p></div></div>
        <UniverseCard />
        <ImportWizard />
        <section className="tablebox" style={{ padding: 16 }}>
          <h2 className="rail-title">Historique des imports</h2>
          {runs.length === 0 ? <p className="sub">Aucun import pour l&apos;instant.</p> : (
            <table style={{ minWidth: 0 }}>
              <thead><tr><th>Date</th><th>Type</th><th>Fichier</th><th>Résultat</th></tr></thead>
              <tbody>{runs.map((r) => {
                const s = JSON.parse(r.stats);
                return <tr key={r.id}><td className="date">{r.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td><td>{KIND_LABEL[r.kind] ?? r.kind}</td><td className="sub">{r.fileName ?? "—"}</td>
                  <td className="sub">{s.created} créés · {s.updated} mis à jour · {s.skipped} ignorés{s.signals ? ` · ${s.signals} signaux` : ""}{s.customers ? ` · ${s.customers} clients exclus` : ""}</td></tr>;
              })}</tbody>
            </table>
          )}
        </section>
      </main>
      <aside className="rail" style={{ position: "static", maxHeight: "none" }}>
        <h2>Liste d&apos;exclusion</h2>
        <ExclusionList rules={rules.map((r) => ({ id: r.id, label: r.label, siren: r.siren, matched: (!!r.siren && ms.has(r.siren)) || (!!r.nameKey && mk.has(r.nameKey)) }))} />
        <h2 style={{ marginTop: 16 }}>Collectes</h2>
        <div className="sub" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {([["france-travail", "Offres France Travail"], ["news", "Actualités"]] as const).map(([k, l]) => (
            <span key={k}>{l} : {lastCollect[k] ? lastCollect[k].toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "jamais"}</span>
          ))}
          <span>Lancer : <code>npm run collect -- --source=all</code> (voir le README pour la planification).</span>
        </div>
        <h2 style={{ marginTop: 16 }}>Exporter depuis HubSpot</h2>
        <ol className="sub" style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <li>Entreprises (ou Contacts) → choisissez votre vue (ex. « Mes entreprises »).</li>
          <li>Bouton « Exporter » → format CSV ou XLSX, « Inclure uniquement les propriétés de la vue » ou toutes.</li>
          <li>Pour les contacts, ajoutez la colonne « Entreprise associée principale » (et son ID) à la vue avant l&apos;export.</li>
          <li>Ordre conseillé : liste d&apos;exclusion, univers cible, entreprises HubSpot, contacts.</li>
        </ol>
        <p className="sub">Réimporter un export plus récent met à jour les fiches sans doublon et détecte les changements de poste.</p>
      </aside>
    </div>
  );
}
