// Classification des actualités : thème du référentiel, type de signal et résumé d'une ligne.
// Claude (structured outputs) si ANTHROPIC_API_KEY est renseignée, sinon règles par mots-clés.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ALL_FONCTIONS, ALL_THEMES } from "./referentiels";
import { normalizeTitle } from "./titles";
import { stripAccents } from "./normalize";

export type NewsInput = { title: string; description: string; source: string | null; date: Date };
export type Classified = {
  index: number;
  relevant: boolean;
  type: "ent" | "dec" | "arr" | "dep";
  theme: string;
  function: string | null;
  person: string | null;
  summary: string;
};

const ResultSchema = z.object({
  items: z.array(z.object({
    index: z.number().int(),
    relevant: z.boolean().describe("true si l'article parle réellement de cette entreprise (pas d'un homonyme ni d'une simple citation)"),
    // Valeurs contrôlées en texte libre + liste dans la description, puis ramenées au référentiel par `coerce`
    // (le SDK ne transmet pas les enum comme contrainte : une valeur hors liste ne doit pas faire échouer le lot).
    type: z.string().describe("une valeur parmi : ent (actualité de l'entreprise), dec (actualité d'un décideur nommé), arr / dep (arrivée ou départ d'une personne dans une fonction RH, SIRH, paie, GTA, formation, DSI ou transformation digitale)"),
    theme: z.string().describe(`exactement un thème parmi : ${ALL_THEMES.join(" | ")}`),
    function: z.string().nullable().describe(`pour arr / dep, exactement une fonction parmi : ${ALL_FONCTIONS.join(" | ")} ; sinon null`),
    person: z.string().nullable().describe("prénom et nom de la personne concernée, sinon null"),
    summary: z.string().describe("résumé factuel d'une ligne en français, 160 caractères maximum, sans reprendre le nom du média"),
  })),
});

const SYSTEM = `Tu fais de la veille commerciale pour un commercial qui vend des logiciels RH (SIRH, paie, gestion des temps, talents) à de grandes entreprises françaises.
Pour chaque article, indique s'il concerne vraiment l'entreprise ciblée, classe-le dans un seul thème de la liste imposée et résume-le en une ligne factuelle.
Choisis « Outils et projets RH » pour tout projet de SIRH, paie, GTA ou digitalisation RH ; « Organisation et effectifs » pour réorganisations, plans sociaux, centres de services partagés ; « Dirigeants et gouvernance » pour les nominations de dirigeants.
Utilise arr / dep uniquement pour une prise ou une fin de poste dans une fonction de la liste des fonctions ; une nomination de PDG ou DG est « dec ».`;

let client: Anthropic | null = null;
export const claudeEnabled = () => !!process.env.ANTHROPIC_API_KEY;

export async function classifyNews(company: string, items: NewsInput[]): Promise<Classified[]> {
  if (!items.length) return [];
  if (!claudeEnabled()) return items.map((it, index) => classifyHeuristic(it, index));
  client ??= new Anthropic();
  const list = items.map((it, i) => `[${i}] ${it.date.toISOString().slice(0, 10)} · ${it.source ?? "?"}\nTitre : ${it.title}\nExtrait : ${it.description || "—"}`).join("\n\n");
  const response = await client.messages.parse({
    model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
    max_tokens: 8000,
    output_config: { effort: "low", format: zodOutputFormat(ResultSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: `Entreprise ciblée : ${company}\n\nArticles :\n\n${list}` }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    return items.map((it, index) => classifyHeuristic(it, index)); // repli sans bloquer la collecte
  }
  return response.parsed_output.items.filter((c) => c.index >= 0 && c.index < items.length).map(coerce);
}

const lower = (s: string) => stripAccents(s.toLowerCase().trim());
const THEME_BY_KEY = new Map(ALL_THEMES.map((t) => [lower(t), t]));
const FN_BY_KEY = new Map(ALL_FONCTIONS.map((f) => [lower(f), f]));

/** Ramène une réponse du modèle aux référentiels (thème, fonction, type). */
export function coerce(c: { index: number; relevant: boolean; type: string; theme: string; function: string | null; person: string | null; summary: string }): Classified {
  const fn = c.function ? FN_BY_KEY.get(lower(c.function)) ?? normalizeTitle(c.function).function : null;
  let type = (["ent", "dec", "arr", "dep"] as const).find((t) => t === lower(c.type)) ?? "ent";
  if ((type === "arr" || type === "dep") && !fn) type = "dec";
  return {
    index: c.index, relevant: c.relevant, type,
    theme: THEME_BY_KEY.get(lower(c.theme)) ?? "Autre",
    function: type === "arr" || type === "dep" ? fn : null,
    person: c.person?.trim() || null,
    summary: c.summary.trim().slice(0, 200),
  };
}

// ----- Repli par mots-clés (sans clé API) -----
const RULES: [RegExp, string][] = [
  [/\b(sirh|logiciel rh|paie|gestion des temps|digitalisation rh|hris|workday|successfactors)\b/, "Outils et projets RH"],
  [/\b(rachat|rachete|acquisition|acquiert|fusion|cession|cede|rapprochement)\b/, "Fusion, acquisition, cession"],
  [/\b(nomme|nommee|nomination|nouveau directeur|nouvelle directrice|prend la tete|succede)\b/, "Dirigeants et gouvernance"],
  [/\b(plan social|pse|reorganisation|suppression de postes|restructuration|centre de services partages)\b/, "Organisation et effectifs"],
  [/\b(recrute|recrutement|embauche|emplois|creations? de postes)\b/, "Croissance et recrutement"],
  [/\b(usine|site|implantation|ouvre|ouverture|demenage)\b/, "Sites et implantations"],
  [/\b(international|etranger|filiale a|s'implante en)\b/, "International"],
  [/\b(chiffre d'affaires|resultats|benefice|perte|semestre|annuel)\b/, "Stratégie et résultats"],
  [/\b(investit|investissement|millions d'euros|leve)\b/, "Investissements"],
  [/\b(greve|syndicat|accord|nao|cse)\b/, "Dialogue social"],
  [/\b(formation|academie|competences|apprentissage|alternance)\b/, "Formation et compétences"],
  [/\b(salon|forum|evenement|conference)\b/, "Événements et salons"],
  [/\b(rse|climat|carbone|environnement|engagement)\b/, "RSE et engagement"],
  [/\b(label|top employer|great place to work|marque employeur)\b/, "Marque employeur et labels"],
  [/\b(contrat|remporte|commande|marche)\b/, "Contrats et réalisations"],
  [/\b(partenariat|partenaire)\b/, "Partenariats"],
];

export function classifyHeuristic(it: NewsInput, index: number): Classified {
  const t = stripAccents(`${it.title} ${it.description}`.toLowerCase());
  const theme = RULES.find(([re]) => re.test(t))?.[1] ?? "Autre";
  const fn = normalizeTitle(it.title).function;
  const move = theme === "Dirigeants et gouvernance" && fn ? (/\b(quitte|depart)\b/.test(t) ? "dep" : "arr") : null;
  return { index, relevant: true, type: move ?? (theme === "Dirigeants et gouvernance" ? "dec" : "ent"), theme, function: move ? fn : null, person: null, summary: it.title.slice(0, 200) };
}
