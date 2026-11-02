// Collecte des offres d'emploi RH / SIRH / Paie / GTA / Formation sur France Travail,
// rattachées aux entreprises en base, avec repérage des outils cités.
import { prisma } from "../lib/db";
import { CompanyIndex } from "../lib/company-index";
import { normalizeTitle } from "../lib/titles";
import { confidenceFromMentions, detectTools } from "../lib/tools-detect";
import { recomputeScores } from "../lib/scoring";
import { FranceTravailClient, isIntermediary, offerUrl, type FtOffer } from "../lib/sources/france-travail";

// Mots-clés interrogés séparément ; chaque offre est ensuite filtrée sur son intitulé normalisé.
export const DEFAULT_KEYWORDS = ["SIRH", "HRIS", "paie", "payroll", "GTA", "DRH", "RRH", "ressources humaines", "formation", "talents"];

export type FtReport = { fetched: number; relevant: number; matched: number; created: number; intermediaries: number; tools: number; unmatched: [string, number][] };

export async function collectFranceTravail(opts: { days?: number; keywords?: string[]; limit?: number; client?: FranceTravailClient; log?: (s: string) => void } = {}): Promise<FtReport> {
  const log = opts.log ?? (() => {});
  const client = opts.client ?? FranceTravailClient.fromEnv();
  const days = [1, 3, 7, 14, 31].find((d) => d >= (opts.days ?? 7)) ?? 31;
  const idx = await CompanyIndex.load();
  const r: FtReport = { fetched: 0, relevant: 0, matched: 0, created: 0, intermediaries: 0, tools: 0, unmatched: [] };
  const unmatched = new Map<string, number>();
  const seen = new Set<string>();
  const touched = new Set<string>();
  const toolHits = new Map<string, Map<string, { category: string; n: number }>>(); // companyId → outil → mentions nouvelles

  outer: for (const kw of opts.keywords ?? DEFAULT_KEYWORDS) {
    let n = 0;
    for await (const o of client.search({ motsCles: kw, publieeDepuis: String(days) })) {
      n++;
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      r.fetched++;
      const norm = normalizeTitle(o.intitule);
      if (!norm.function) continue;
      r.relevant++;
      const employer = o.entreprise?.nom?.trim();
      if (!employer) continue;
      const { id: companyId } = idx.find({ name: employer });
      if (!companyId) { unmatched.set(employer, (unmatched.get(employer) ?? 0) + 1); continue; }
      if (isIntermediary(o)) { r.intermediaries++; continue; }
      r.matched++;
      if (await saveOffer(o, companyId, norm)) {
        r.created++;
        touched.add(companyId);
        // Les outils ne comptent que pour les offres nouvelles (pas de double comptage d'une collecte à l'autre)
        const hits = toolHits.get(companyId) ?? new Map();
        for (const t of detectTools(`${o.intitule}\n${o.description ?? ""}`)) hits.set(t.tool, { category: t.category, n: (hits.get(t.tool)?.n ?? 0) + 1 });
        toolHits.set(companyId, hits);
      }
      if (opts.limit && r.created >= opts.limit) break outer;
    }
    log(`« ${kw} » : ${n} offres lues`);
  }

  for (const [companyId, hits] of toolHits) {
    for (const [tool, { category, n }] of hits) {
      const prev = await prisma.toolInPlace.findUnique({ where: { companyId_tool: { companyId, tool } } });
      if (prev) {
        const mentions = prev.mentions + n;
        await prisma.toolInPlace.update({ where: { id: prev.id }, data: { mentions, confidence: Math.max(prev.confidence, confidenceFromMentions(mentions)) } });
      } else {
        await prisma.toolInPlace.create({ data: { companyId, tool, category, mentions: n, confidence: confidenceFromMentions(n), source: "france-travail" } });
      }
      r.tools++;
    }
  }

  r.unmatched = [...unmatched].sort((a, b) => b[1] - a[1]).slice(0, 30);
  if (touched.size) await recomputeScores([...touched]);
  await prisma.importRun.create({ data: { kind: "france-travail", fileName: `${days} derniers jours`, stats: JSON.stringify({ created: r.created, updated: 0, skipped: r.relevant - r.matched, signals: r.created, tools: r.tools, unmatched: r.unmatched.slice(0, 10) }) } });
  await prisma.setting.upsert({ where: { key: "lastCollect:france-travail" }, create: { key: "lastCollect:france-travail", value: JSON.stringify(new Date()) }, update: { value: JSON.stringify(new Date()) } });
  return r;
}

async function saveOffer(o: FtOffer, companyId: string, norm: { function: string | null; functionFamily: string | null }) {
  const externalId = `ft:${o.id}`;
  if (await prisma.signal.findUnique({ where: { externalId }, select: { id: true } })) return false;
  const lieu = o.lieuTravail?.libelle?.replace(/^\d+ - /, "");
  await prisma.signal.create({
    data: {
      companyId, type: "job", function: norm.function, functionFamily: norm.functionFamily, title: o.intitule,
      summary: [o.intitule, [o.typeContrat, lieu].filter(Boolean).join(", ")].filter(Boolean).join(" — "),
      url: offerUrl(o), date: new Date(o.dateCreation), source: "france-travail", externalId,
    },
  });
  return true;
}
