// Lecture de flux RSS : Google News par entreprise, et flux additionnels (presse RH, régionale…).
import { XMLParser } from "fast-xml-parser";
import { stripAccents } from "../normalize";

export type NewsItem = { title: string; link: string; date: Date; source: string | null; description: string };

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });
const text = (v: unknown): string => (v == null ? "" : typeof v === "object" ? String((v as Record<string, unknown>)["#text"] ?? "") : String(v));
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

export function parseRss(xml: string): NewsItem[] {
  const doc = parser.parse(xml);
  const raw = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map((it: Record<string, unknown>) => {
    const source = text(it.source) || null;
    let title = stripHtml(text(it.title));
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const link = typeof it.link === "object" && it.link ? String((it.link as Record<string, unknown>)["@_href"] ?? text(it.link)) : text(it.link);
    const date = new Date(text(it.pubDate) || text(it.published) || text(it.updated) || Date.now());
    return { title, link, date: isNaN(+date) ? new Date() : date, source, description: stripHtml(text(it.description) || text(it.summary)).slice(0, 600) };
  }).filter((i) => i.title && i.link);
}

const LEGAL = /\b(SAS|SASU|SA|SARL|SE|SCA|SNC|EURL|GIE|SCOP)\b\.?/g;
/** Nom utilisé pour la recherche : sans forme juridique ni mention « [DÉMO] ». */
export const searchName = (name: string) => name.replace(/\[DÉMO\]\s*/i, "").replace(LEGAL, "").replace(/\s{2,}/g, " ").trim();

export const googleNewsUrl = (name: string, days = 30) =>
  `https://news.google.com/rss/search?${new URLSearchParams({ q: `"${searchName(name)}" when:${days}d`, hl: "fr", gl: "FR", ceid: "FR:fr" })}`;

const norm = (s: string) => ` ${stripAccents(s.toLowerCase()).replace(/[^a-z0-9]+/g, " ")} `;
/** Le texte cite-t-il l'entreprise (mot entier, sans accents ni casse) ? */
export const mentions = (textToSearch: string, name: string) => {
  const n = norm(searchName(name)).trim();
  return n.length >= 3 && norm(textToSearch).includes(` ${n} `);
};

export async function fetchFeed(url: string, fetchImpl: typeof fetch = fetch): Promise<NewsItem[]> {
  const res = await fetchImpl(url, { headers: { "User-Agent": "VigieRH/1.0 (veille personnelle)", Accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Flux ${new URL(url).hostname} : HTTP ${res.status}`);
  return parseRss(await res.text());
}
