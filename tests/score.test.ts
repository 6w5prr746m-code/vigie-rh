import { describe, expect, it } from "vitest";
import { computeScore } from "../src/lib/score";

const now = new Date("2026-10-30T12:00:00");
const d = (days: number) => new Date(now.getTime() - days * 864e5);

describe("computeScore (formule du prototype)", () => {
  it("additionne les 5 composantes avec leurs plafonds", () => {
    const r = computeScore({
      headcount: 1800, groupHeadcount: 3000, tools: ["Workday", "Cegid Paie", "Silae"],
      signals: [
        { type: "ent", theme: "Outils et projets RH", function: null, date: d(5) },
        { type: "arr", theme: null, function: "Responsable SIRH", date: d(10) },
        { type: "ent", theme: "Autre", function: null, date: d(20) },
        { type: "ent", theme: "Outils et projets RH", function: null, date: d(200) }, // hors fenêtre
      ],
    }, now);
    expect(r.parts.map((p) => p[1])).toEqual([16, 10, 6, 15, 6]);
    expect(r.total).toBe(53);
    expect(r.count).toBe(4);
    expect(r.last).toEqual(d(5));
  });

  it("applique les plafonds et le facteur taille hors cible", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ type: "dep", theme: null, function: "DRH", date: d(i) }));
    const r = computeScore({ headcount: 300, groupHeadcount: null, tools: [], signals: many }, now);
    expect(r.parts.map((p) => p[1])).toEqual([40, 20, 15, 5, 0]);
    expect(r.total).toBe(80);
  });
});
