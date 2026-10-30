import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isPublicEntity, toCompany, trancheCodesFrom, universeParams, universeSections, type ApiPage } from "../src/lib/sources/recherche-entreprises";

const page: ApiPage = JSON.parse(readFileSync("tests/fixtures/recherche-entreprises-page.json", "utf8"));

describe("Recherche d'entreprises", () => {
  it("construit les critères de l'univers cible (≥ 1 000 sal., hors public)", () => {
    expect(trancheCodesFrom(1000)).toEqual(["42", "51", "52", "53"]);
    expect(universeSections({ minHeadcount: 1000, includePublic: false })).not.toContain("O");
    expect(universeParams({ minHeadcount: 1000, includePublic: false }, "C")).toEqual({ tranche_effectif_salarie: "42,51,52,53", etat_administratif: "A", section_activite_principale: "C" });
  });
  it("convertit une fiche en entreprise", () => {
    expect(toCompany(page.results[0])).toEqual({ siren: "900000001", name: "Exemple Fictif Industries", nafCode: "28.29B", sector: "Industrie", headcountRange: "51", headcount: 2000, city: "Lyon 3eme", isPublic: false });
  });
  it("repère les entités publiques", () => {
    expect(page.results.map(isPublicEntity)).toEqual([false, true, false]);
  });
});
