import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { classifyHeuristic, coerce } from "../src/lib/classify";
import { mentions, parseRss, searchName } from "../src/lib/sources/news";

describe("actualités", () => {
  it("lit un flux Google News et retire le nom du média du titre", () => {
    const items = parseRss(readFileSync("tests/fixtures/google-news.xml", "utf8"));
    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({ title: "Exemple Fictif Industries lance un appel d'offres pour remplacer son SIRH", source: "Journal Fictif" });
  });
  it("vérifie que l'article cite l'entreprise (mot entier)", () => {
    expect(searchName("Exemple Fictif Industries SAS")).toBe("Exemple Fictif Industries");
    expect(mentions("Le groupe EXEMPLE FICTIF INDUSTRIES recrute", "Exemple Fictif Industries SAS")).toBe(true);
    expect(mentions("Exemple Fictif Industriesxyz", "Exemple Fictif Industries")).toBe(false);
  });
  it("ramène les réponses du modèle aux référentiels", () => {
    expect(coerce({ index: 0, relevant: true, type: "ARR", theme: "outils et projets rh", function: "Directrice SIRH", person: " Alice ", summary: " x " }))
      .toEqual({ index: 0, relevant: true, type: "arr", theme: "Outils et projets RH", function: "Directeur SIRH", person: "Alice", summary: "x" });
    expect(coerce({ index: 1, relevant: true, type: "dep", theme: "inconnu", function: null, person: null, summary: "y" })).toMatchObject({ type: "dec", theme: "Autre", function: null });
  });
  it("classe sans clé API par mots-clés", () => {
    expect(classifyHeuristic({ title: "Le groupe annonce un plan social", description: "", source: null, date: new Date() }, 0).theme).toBe("Organisation et effectifs");
  });
});
