// npm run collect -- --source=univers [--limit=5] [--min=1000] [--public]
import { prisma } from "../lib/db";
import { estimateUniverse } from "../lib/sources/recherche-entreprises";
import { importUniverse } from "./univers";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "1"]; }));
const SOURCES = ["univers"];

async function main() {
  const source = args.source;
  if (!SOURCES.includes(source)) {
    console.error(`Usage : npm run collect -- --source=${SOURCES.join("|")} [--limit=N]\n  univers : --min=1000 (effectif minimum) --public (inclure le public) --estimate (compter seulement)`);
    process.exit(1);
  }
  if (source === "univers") {
    const criteria = { minHeadcount: Number(args.min ?? 1000), includePublic: !!args.public };
    if (args.estimate) {
      const counts = await estimateUniverse(criteria);
      console.log(counts, "total :", Object.values(counts).reduce((a, b) => a + b, 0));
      return;
    }
    const r = await importUniverse(criteria, { limit: args.limit ? Number(args.limit) : undefined, log: console.log });
    console.log(`Lues : ${r.fetched} · créées : ${r.created} · mises à jour : ${r.updated} · complétées (SIREN ajouté) : ${r.linkedBySiren} · publiques écartées : ${r.skippedPublic} · clients exclus : ${r.customers}`);
  }
}

main().catch((e) => { console.error(e.message ?? e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
