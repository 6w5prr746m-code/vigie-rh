import { describe, expect, it } from "vitest";
import { parseFilters, signalWhere, toQuery } from "../src/lib/filters";

describe("filtres d'URL", () => {
  it("fait l'aller-retour URL → filtres → URL sans les valeurs par défaut", () => {
    const f = parseFilters({ secteurs: "Banque,Public", tranches: "2,9", period: "30", page: "3", pub: "oui", foreign: "1" });
    expect(f.tranches).toEqual([2]); // 9 hors référentiel
    expect(toQuery(f)).toBe("?period=30&secteurs=Banque%2CPublic&tranches=2&pub=oui&foreign=1&page=3");
    expect(toQuery(parseFilters({}))).toBe("?");
  });

  it("combine thèmes et fonctions comme le prototype", () => {
    const both = signalWhere(parseFilters({ themes: "International", fns: "DRH" }));
    expect(JSON.stringify(both)).toContain('"OR":[{"theme":{"in":["International"]}},{"function":{"in":["DRH"]}}');
    const themesOnly = signalWhere(parseFilters({ themes: "International" }));
    expect(JSON.stringify(themesOnly)).toContain('{"theme":{"in":["International"]}}');
  });
});
