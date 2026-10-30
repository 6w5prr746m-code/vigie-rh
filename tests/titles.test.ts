import { describe, expect, it } from "vitest";
import { normalizeTitle } from "../src/lib/titles";

const cases: [string, string | null][] = [
  ["Directrice des Ressources Humaines", "DRH"],
  ["DRH Groupe", "DRH"],
  ["Chief People Officer", "DRH"],
  ["HR Business Partner", "Responsable RH"],
  ["Responsable RH adjointe", "Responsable RH"],
  ["Chef de projet SIRH", "Chef de projet SIRH"],
  ["HRIS Manager", "Responsable SIRH"],
  ["Chargée SIRH", "Chargé SIRH"],
  ["Head of Payroll", "Directeur paie"],
  ["Gestionnaire de paie confirmé(e)", "Gestionnaire de paie"],
  ["Responsable paie et administration du personnel", "Responsable paie"],
  ["Responsable GTA", "Responsable GTA"],
  ["Responsable formation et développement", "Responsable formation"],
  ["Talent Acquisition Manager", "Responsable talents"],
  ["DSI", "DSI"],
  ["Directeur des systèmes d'information", "DSI"],
  ["Directeur transformation digitale", "Transformation digitale"],
  ["Directeur commercial", null],
];

describe("normalizeTitle", () => {
  it.each(cases)("%s → %s", (raw, fn) => expect(normalizeTitle(raw).function).toBe(fn));
  it("renvoie la famille", () => expect(normalizeTitle("Chef de projet paie").functionFamily).toBe("Paie"));
});
