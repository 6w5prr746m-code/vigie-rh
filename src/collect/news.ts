// Collecte des actualités des comptes suivis (et optionnellement des N meilleurs scores) :
// Google News RSS par entreprise + flux additionnels (NEWS_FEEDS), classés par Claude.
import { createHash } from "node:crypto";
import { prisma } from "../lib/db";
import { nameKey } from "../lib/normalize";
import { recomputeScores } from "../lib/scoring";
import { classifyNews, claudeEnabled } from "../lib/classify";
import { fnFamily } from "../lib/referentiels";
import { fetchFeed, googleNewsUrl, mentions, searchName, type NewsItem } from "../lib/sources/news";

export type NewsReport = { companies: number; fetched: number; candidates: number; created: number; ignored: number; errors: string[]; mode: "claude" | "mots-clés" };

const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function collectNews(opts: { top?: number; days?: number; limit?: number; fetchImpl?: typeof fetch; log?: (s: string) => void } = {}): Promise<NewsReport> {
  const log = opts.log ?? (() => {});
  const days = opts.days ?? 30;
  const since = new Date(Date.now() - days * 864e5);
  const r: NewsReport = { companies: 0, fetched: 0, candidates: 0, created: 0, ignored: 0, errors: [], mode: claudeEnabled() ? "claude" : "mots-clés" };

  // Périmètre : comptes suivis + N meilleurs scores, hors exclus et hors démo
  const base = { excluded: { is: null }, isDemo: false } as const;
  const followed = await prisma.company.findMany({ where: { ...base, followed: { isNot: null } }, select: { id: true, name: true } });
  const top = opts.top ? await prisma.company.findMany({ where: base, orderBy: { scoreTotal: "desc" }, take: opts.top, select: { id: true, name: true } }) : [];
  let targets = [...new Map([...followed, ...top].map((c) => [c.id, c])).values()];
  if (opts.limit) targets = targets.slice(0, opts.limit);
  if (!targets.length) throw new Error("Aucun compte à surveiller : suivez des comptes (★) ou utilisez --top=50.");
  r.companies = targets.length;

  const candidates = new Map<string, NewsItem[]>(targets.map((c) => [c.id, []]));
  for (const c of targets) {
    try {
      const items = await fetchFeed(googleNewsUrl(c.name, days), opts.fetchImpl);
      r.fetched += items.length;
      candidates.get(c.id)!.push(...items.filter((i) => mentions(`${i.title} ${i.description}`, c.name)));
    } catch (e) { r.errors.push(`${c.name} : ${(e as Error).message}`); }
    await sleep(opts.fetchImpl ? 0 : 1000); // politesse envers Google News
  }
  for (const url of (process.env.NEWS_FEEDS ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    try {
      const items = await fetchFeed(url, opts.fetchImpl);
      r.fetched += items.length;
      for (const i of items) for (const c of targets) if (mentions(`${i.title} ${i.description}`, c.name)) candidates.get(c.id)!.push(i);
    } catch (e) { r.errors.push(`${url} : ${(e as Error).message}`); }
  }

  const touched: string[] = [];
  for (const c of targets) {
    // Nouveaux articles uniquement : ni déjà vus (lien), ni même titre déjà enregistré
    const known = new Set((await prisma.signal.findMany({ where: { companyId: c.id, source: "news" }, select: { title: true } })).map((s) => nameKey(s.title ?? "")));
    const fresh: NewsItem[] = [];
    for (const i of candidates.get(c.id)!) {
      if (i.date < since || known.has(nameKey(i.title))) continue;
      if (await prisma.signal.findUnique({ where: { externalId: `news:${hash(i.link)}` }, select: { id: true } })) continue;
      known.add(nameKey(i.title));
      fresh.push(i);
    }
    r.candidates += fresh.length;
    for (let k = 0; k < fresh.length; k += 15) {
      const chunk = fresh.slice(k, k + 15);
      let results;
      try { results = await classifyNews(searchName(c.name), chunk); }
      catch (e) { r.errors.push(`Classification ${c.name} : ${(e as Error).message}`); continue; }
      for (const res of results) {
        const it = chunk[res.index];
        if (!res.relevant) { r.ignored++; continue; }
        await prisma.signal.create({
          data: {
            companyId: c.id, type: res.type, theme: res.type === "arr" || res.type === "dep" ? null : res.theme,
            function: res.function, functionFamily: fnFamily(res.function), person: res.person,
            title: it.title, summary: res.summary || it.title, url: it.link, date: it.date, source: "news", externalId: `news:${hash(it.link)}`,
          },
        });
        r.created++;
        touched.push(c.id);
      }
    }
    if (fresh.length) log(`${c.name} : ${fresh.length} nouveaux articles`);
  }

  if (touched.length) await recomputeScores(touched);
  await prisma.importRun.create({ data: { kind: "news", fileName: `${r.companies} comptes · ${r.mode}`, stats: JSON.stringify({ created: r.created, updated: 0, skipped: r.ignored, signals: r.created }) } });
  await prisma.setting.upsert({ where: { key: "lastCollect:news" }, create: { key: "lastCollect:news", value: JSON.stringify(new Date()) }, update: { value: JSON.stringify(new Date()) } });
  return r;
}
