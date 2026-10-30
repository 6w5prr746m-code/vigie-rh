// Import en ligne de commande : npm run import -- --kind=contacts --file=export.csv [--no-create] [--dry-run]
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseFile } from "../lib/import/parse";
import { autoMap, mappingError, FIELDS, type ImportKind } from "../lib/import/mapping";
import { runImport } from "../lib/import/run";
import { prisma } from "../lib/db";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "1"]; }));
const kind = args.kind as ImportKind;
if (!["entreprises", "contacts", "exclusions"].includes(kind) || !args.file) {
  console.error("Usage : npm run import -- --kind=entreprises|contacts|exclusions --file=chemin.csv|.xlsx [--no-create] [--dry-run]");
  process.exit(1);
}

(async () => {
  const table = await parseFile(await readFile(args.file), args.file);
  const mapping = autoMap(table.headers, kind);
  console.log(`${table.rows.length} lignes, colonnes reconnues :`);
  for (const f of FIELDS[kind]) console.log(`  ${f.label.padEnd(38)} ← ${mapping[f.key] ?? "—"}`);
  const err = mappingError(kind, mapping);
  if (err) { console.error(`\n${err} Utilisez la page /importer pour associer les colonnes à la main.`); process.exit(1); }
  if (args["dry-run"]) return;
  const r = await runImport(kind, table.rows, mapping, { createMissingCompanies: !args["no-create"], fileName: basename(args.file) });
  console.log(`\nCréés : ${r.created} · mis à jour : ${r.updated} · ignorés : ${r.skipped} · entreprises créées : ${r.createdCompanies} · clients exclus : ${r.customers} · signaux : ${r.signals}${kind === "exclusions" ? ` · règles sans entreprise en base : ${r.pendingExclusions}` : ""}`);
  r.issues.slice(0, 30).forEach((i) => console.log(`  ligne ${i.row} : ${i.message}`));
  if (r.issues.length > 30) console.log(`  … ${r.issues.length - 30} autres remarques`);
})().finally(() => prisma.$disconnect());
