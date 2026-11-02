// npm run collect -- --source=univers|france-travail|news|all [--limit=N] …
import { prisma } from "../lib/db";
import { estimateUniverse } from "../lib/sources/recherche-entreprises";
import { importUniverse } from "./univers";
import { collectFranceTravail } from "./france-travail";
import { collectNews } from "./news";
import { recomputeScores } from "../lib/scoring";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "1"]; }));
const num = (k: string) => (args[k] ? Number(args[k]) : undefined);

const USAGE = `Usage : npm run collect -- --source=<source> [options]
  univers         --min=1000 (effectif minimum) --public (inclure le public) --estimate (compter seulement) --limit=N
  france-travail  --days=7 (1, 3, 7, 14 ou 31) --keywords=SIRH,paie --limit=N (nombre d'offres enregistrées)
  news            --top=N (ajoute les N meilleurs scores aux comptes suivis) --days=30 --limit=N (nombre de comptes)
  all             france-travail puis news (options par défaut), puis recalcul de tous les scores
  scores          recalcule tous les scores`;

async function franceTravail() {
  const r = await collectFranceTravail({ days: num("days"), limit: num("limit"), keywords: args.keywords?.split(","), log: console.log });
  console.log(`France Travail · lues : ${r.fetched} · fonctions ciblées : ${r.relevant} · rattachées : ${r.matched} · nouvelles : ${r.created} · cabinets / agences écartés : ${r.intermediaries} · outils mis à jour : ${r.tools}`);
  if (r.unmatched.length) console.log("Employeurs non rattachés (ajoutez-les via « + Ajouter » ou l'univers cible) :\n" + r.unmatched.slice(0, 15).map(([n, k]) => `  ${k} × ${n}`).join("\n"));
}

async function news() {
  const r = await collectNews({ top: num("top"), days: num("days"), limit: num("limit"), log: console.log });
  console.log(`Actualités (${r.mode}) · comptes : ${r.companies} · articles lus : ${r.fetched} · nouveaux : ${r.candidates} · signaux créés : ${r.created} · hors sujet : ${r.ignored}`);
  r.errors.forEach((e) => console.log(`  ⚠ ${e}`));
}

async function main() {
  switch (args.source) {
    case "univers": {
      const criteria = { minHeadcount: Number(args.min ?? 1000), includePublic: !!args.public };
      if (args.estimate) {
        const counts = await estimateUniverse(criteria);
        console.log(counts, "total :", Object.values(counts).reduce((a, b) => a + b, 0));
        return;
      }
      const r = await importUniverse(criteria, { limit: num("limit"), log: console.log });
      console.log(`Lues : ${r.fetched} · créées : ${r.created} · mises à jour : ${r.updated} · complétées (SIREN ajouté) : ${r.linkedBySiren} · publiques écartées : ${r.skippedPublic} · clients exclus : ${r.customers}`);
      return;
    }
    case "france-travail": return franceTravail();
    case "news": return news();
    case "all":
      await franceTravail().catch((e) => console.error(`France Travail : ${e.message}`));
      await news().catch((e) => console.error(`Actualités : ${e.message}`));
      console.log(`Scores recalculés : ${await recomputeScores()}`);
      return;
    case "scores": console.log(`Scores recalculés : ${await recomputeScores()}`); return;
    default:
      console.error(USAGE);
      process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e.message ?? e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
