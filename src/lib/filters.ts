// Filtres des vues : lus depuis l'URL (?secteurs=…&page=…) et traduits en clauses Prisma.
// Tout est côté serveur : pas de limite sur le nombre de résultats consultables.
import type { Prisma } from "@prisma/client";
import { STRUCTURES, TRANCHES, SIGNAL_TYPES } from "./referentiels";
import { nameKey } from "./normalize";

export type RawParams = Record<string, string | string[] | undefined>;

export type Filters = {
  q: string;
  period: string; // 7 | 30 | 90 | all
  types: string[];
  themes: string[];
  fns: string[];
  secteurs: string[];
  tranches: number[];
  structs: string[];
  pub: string[]; // oui | non
  foreign: boolean;
  outils: string[];
  rec: string; // any | 7 | 30 | 90 | some
  carto: "entreprises" | "contacts";
  page: number;
  per: number;
  sort: string | null;
  dir: 1 | -1;
  fiche: string | null;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const list = (v: string | string[] | undefined) => one(v).split(",").map((s) => s.trim()).filter(Boolean);

export function parseFilters(p: RawParams): Filters {
  const period = one(p.period);
  const rec = one(p.rec);
  const per = Number(one(p.per)) || 25;
  return {
    q: one(p.q).trim(),
    period: ["7", "30", "90"].includes(period) ? period : "all",
    types: list(p.types).filter((t) => t in SIGNAL_TYPES),
    themes: list(p.themes),
    fns: list(p.fns),
    secteurs: list(p.secteurs),
    tranches: list(p.tranches).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < TRANCHES.length),
    structs: list(p.structs).filter((s) => s in STRUCTURES),
    pub: list(p.pub).filter((s) => s === "oui" || s === "non"),
    foreign: one(p.foreign) === "1",
    outils: list(p.outils),
    rec: ["7", "30", "90", "some"].includes(rec) ? rec : "any",
    carto: one(p.carto) === "contacts" ? "contacts" : "entreprises",
    page: Math.max(1, Math.floor(Number(one(p.page)) || 1)),
    per: [25, 50, 100].includes(per) ? per : 25,
    sort: one(p.sort) || null,
    dir: one(p.dir) === "asc" ? 1 : -1,
    fiche: one(p.fiche) || null,
  };
}

/** Sérialise des filtres (avec surcharges) en query string, sans les valeurs par défaut. */
export function toQuery(f: Filters, over: Partial<Filters> = {}): string {
  const m = { ...f, ...over };
  const sp = new URLSearchParams();
  const put = (k: string, v: string | number | null | undefined, def?: string | number) => {
    if (v !== null && v !== undefined && v !== "" && v !== def) sp.set(k, String(v));
  };
  put("q", m.q);
  put("period", m.period, "all");
  put("types", m.types.join(","));
  put("themes", m.themes.join(","));
  put("fns", m.fns.join(","));
  put("secteurs", m.secteurs.join(","));
  put("tranches", m.tranches.join(","));
  put("structs", m.structs.join(","));
  put("pub", m.pub.join(","));
  put("foreign", m.foreign ? "1" : "");
  put("outils", m.outils.join(","));
  put("rec", m.rec, "any");
  put("carto", m.carto, "entreprises");
  put("page", m.page, 1);
  put("per", m.per, 25);
  put("sort", m.sort);
  if (m.sort) put("dir", m.dir === 1 ? "asc" : "desc");
  put("fiche", m.fiche);
  const s = sp.toString();
  return s ? `?${s}` : "?";
}

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);

/** Périmètre « entreprise » commun à toutes les vues (rail : secteur, effectif, structure…). */
export function companyWhere(f: Filters, opts: { recency?: boolean } = {}): Prisma.CompanyWhereInput {
  const and: Prisma.CompanyWhereInput[] = [{ excluded: { is: null } }];
  if (f.q) and.push({ OR: [{ nameKey: { contains: nameKey(f.q) } }, { siren: { contains: f.q.replace(/\s/g, "") } }] });
  if (f.secteurs.length) and.push({ sector: { in: f.secteurs } });
  if (f.tranches.length)
    and.push({ OR: f.tranches.map((i) => ({ headcount: { gte: TRANCHES[i][0], lte: TRANCHES[i][1] } })) });
  if (f.structs.length) and.push({ structure: { in: f.structs } });
  if (f.pub.length === 1) and.push({ isPublic: f.pub[0] === "oui" });
  if (f.foreign) and.push({ foreignGroup: true });
  if (f.outils.length) and.push({ tools: { some: { tool: { in: f.outils }, OR: [{ feedback: null }, { feedback: { not: "ko" } }] } } });
  if (opts.recency && f.rec !== "any")
    and.push(f.rec === "some" ? { lastSignalAt: { not: null } } : { lastSignalAt: { gte: daysAgo(Number(f.rec)) } });
  return { AND: and };
}

/**
 * Signaux du périmètre. Même logique que le prototype pour thèmes / fonctions :
 * un signal d'actualité passe par son thème, un signal emploi / mouvement par sa fonction ;
 * si les deux filtres sont posés, l'un ou l'autre suffit.
 */
export function signalWhere(f: Filters, opts: { ignoreTypes?: boolean } = {}): Prisma.SignalWhereInput {
  const and: Prisma.SignalWhereInput[] = [{ company: companyWhere(f) }];
  if (f.period !== "all") and.push({ date: { gte: daysAgo(Number(f.period)) } });
  if (!opts.ignoreTypes && f.types.length) and.push({ type: { in: f.types } });
  if (f.themes.length && f.fns.length)
    and.push({ OR: [{ theme: { in: f.themes } }, { function: { in: f.fns } }, { theme: null, function: null }] });
  else if (f.themes.length) and.push({ theme: { in: f.themes } });
  else if (f.fns.length) and.push({ function: { in: f.fns } });
  return { AND: and };
}

export function contactWhere(f: Filters): Prisma.ContactWhereInput {
  const and: Prisma.ContactWhereInput[] = [{ company: companyWhere(f, { recency: true }) }];
  if (f.fns.length) and.push({ function: { in: f.fns } });
  return { AND: and };
}

export const pageArgs = (f: Filters) => ({ skip: (f.page - 1) * f.per, take: f.per });
