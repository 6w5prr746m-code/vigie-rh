import { describe, expect, it } from "vitest";
import { confidenceFromMentions, detectTools } from "../src/lib/tools-detect";

const names = (t: string) => detectTools(t).map((x) => x.tool);

describe("detectTools", () => {
  it("repère les outils cités dans une annonce", () => {
    expect(names("Vous maîtrisez SAP HR et Kelio ; une connaissance de Workday est un plus.")).toEqual(["SAP HCM", "Workday", "Kelio"]);
    expect(names("Paie sous Cegid HR Ultimate, GTA Horoquartz")).toEqual(["Cegid Paie", "Horoquartz"]);
    expect(names("Environnement ADP (Decidium) et SuccessFactors")).toEqual(["ADP", "SAP SuccessFactors"]);
  });
  it("évite les faux positifs courants", () => {
    expect(names("Poste basé près de l'aéroport, ADP aéroport de Paris")).toEqual([]);
    expect(names("un collaborateur sage et rigoureux, lucca")).toEqual([]);
  });
  it("calcule la confiance selon le nombre de mentions", () => {
    expect([1, 2, 3, 4, 9].map(confidenceFromMentions)).toEqual([2, 3, 4, 5, 5]);
  });
});
