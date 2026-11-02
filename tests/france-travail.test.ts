import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FranceTravailClient, isIntermediary, type FtOffer } from "../src/lib/sources/france-travail";

const offers: FtOffer[] = JSON.parse(readFileSync("tests/fixtures/france-travail-offres.json", "utf8")).resultats;

describe("France Travail", () => {
  it("écarte les annonces de cabinets / agences pour le compte d'un client", () => {
    expect(offers.map(isIntermediary)).toEqual([false, false, true, false, false]);
    expect(isIntermediary({ id: "x", intitule: "", dateCreation: "", description: "Pour l'un de nos clients, leader du secteur" })).toBe(true);
  });

  it("s'authentifie puis pagine selon Content-Range", async () => {
    const urls: string[] = [];
    const page = (n: number) => ({ resultats: Array.from({ length: n }, (_, i) => ({ id: String(i), intitule: "x", dateCreation: "2026-01-01" })) });
    const fake = (async (url: string) => {
      urls.push(String(url));
      if (String(url).includes("access_token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 1499 }));
      const range = new URL(url).searchParams.get("range");
      return new Response(JSON.stringify(page(range === "0-149" ? 150 : 20)), { status: 206, headers: { "Content-Range": "offres 0-149/170" } });
    }) as typeof fetch;
    const client = new FranceTravailClient("id", "secret", fake);
    let n = 0;
    for await (const offer of client.search({ motsCles: "paie" })) if (offer.id) n++;
    expect(n).toBe(170);
    expect(urls.filter((u) => u.includes("access_token"))).toHaveLength(1);
    expect(urls.filter((u) => u.includes("range="))).toHaveLength(2);
  });
});
