// Import de l'univers cible depuis Recherche d'entreprises (une requête paginée par section NAF).
import { prisma } from "../lib/db";
import { nameKey } from "../lib/normalize";
import { applyExclusionRules } from "../lib/exclusions";
import { recomputeScores } from "../lib/scoring";
import { apiSearch, isPublicEntity, toCompany, universeParams, universeSections, type ApiCompany, type UniverseCriteria } from "../lib/sources/recherche-entreprises";

export type UniverseReport = { fetched: number; created: number; updated: number; linkedBySiren: number; skippedPublic: number; customers: number };

/** Crée ou met à jour une entreprise depuis une fiche de l'API. Renvoie l'action effectuée. */
export async function upsertFromApi(api: ApiCompany): Promise<{ id: string; action: "created" | "updated" | "linked" }> {
  const d = toCompany(api);
  const existing = await prisma.company.findUnique({ where: { siren: d.siren } });
  const sireneData = {
    nafCode: d.nafCode, headcountRange: d.headcountRange, isPublic: d.isPublic,
  };
  if (existing) {
    await prisma.company.update({
      where: { id: existing.id },
      data: {
        ...sireneData,
        // les valeurs précises venues de vos fichiers priment sur la tranche INSEE
        ...(existing.headcountSource && existing.headcountSource !== "sirene" ? {} : { headcount: d.headcount, headcountSource: "sirene" }),
        ...(existing.sector ? {} : { sector: d.sector }),
        ...(existing.city ? {} : { city: d.city }),
      },
    });
    return { id: existing.id, action: "updated" };
  }
  // Entreprise déjà importée sans SIREN (ex. export HubSpot) : on la complète si le nom correspond sans ambiguïté
  const sameName = await prisma.company.findMany({ where: { nameKey: nameKey(d.name), siren: null }, take: 2 });
  if (sameName.length === 1) {
    const c = sameName[0];
    await prisma.company.update({
      where: { id: c.id },
      data: {
        siren: d.siren, ...sireneData,
        ...(c.headcount == null ? { headcount: d.headcount, headcountSource: "sirene" } : {}),
        ...(c.sector ? {} : { sector: d.sector }), ...(c.city ? {} : { city: d.city }),
      },
    });
    return { id: c.id, action: "linked" };
  }
  const c = await prisma.company.create({ data: { ...d, nameKey: nameKey(d.name), headcountSource: d.headcount != null ? "sirene" : null } });
  return { id: c.id, action: "created" };
}

export async function importUniverse(c: UniverseCriteria, opts: { limit?: number; log?: (s: string) => void; fetchImpl?: typeof fetch } = {}): Promise<UniverseReport> {
  const log = opts.log ?? (() => {});
  const r: UniverseReport = { fetched: 0, created: 0, updated: 0, linkedBySiren: 0, skippedPublic: 0, customers: 0 };
  const touched: string[] = [];
  const limit = opts.limit ?? Infinity;
  outer: for (const section of universeSections(c)) {
    let page = 1, pages = 1;
    do {
      const res = await apiSearch({ ...universeParams(c, section), per_page: 25, page }, opts.fetchImpl);
      pages = Math.min(res.total_pages, 400); // 400 × 25 = plafond de 10 000 résultats de l'API
      if (page === 1) log(`Section ${section} : ${res.total_results} entreprises`);
      for (const api of res.results) {
        if (r.fetched >= limit) break outer;
        r.fetched++;
        if (!c.includePublic && isPublicEntity(api)) { r.skippedPublic++; continue; }
        const { id, action } = await upsertFromApi(api);
        touched.push(id);
        if (action === "created") r.created++; else if (action === "linked") r.linkedBySiren++; else r.updated++;
      }
      page++;
    } while (page <= pages);
  }
  r.customers = (await applyExclusionRules(touched)).length;
  await recomputeScores(touched);
  await prisma.importRun.create({ data: { kind: "univers", fileName: `≥ ${c.minHeadcount} sal.${c.includePublic ? ", public inclus" : ", hors public"}`, stats: JSON.stringify({ created: r.created, updated: r.updated + r.linkedBySiren, skipped: r.skippedPublic, customers: r.customers }) } });
  return r;
}
