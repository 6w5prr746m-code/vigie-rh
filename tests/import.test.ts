import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseFile } from "../src/lib/import/parse";
import { autoMap, isCustomerValue, parseDateLoose, parseIntLoose, parseSiren } from "../src/lib/import/mapping";
import { sectorFromLabel, sectorFromNaf } from "../src/lib/sectors";

describe("lecture des fichiers et correspondance des colonnes", () => {
  it("lit un CSV ; et reconnaît un export HubSpot entreprises en français", async () => {
    const t = await parseFile(readFileSync("tests/fixtures/hubspot-entreprises.csv"), "x.csv");
    expect(t.rows).toHaveLength(4);
    const m = autoMap(t.headers, "entreprises");
    expect(m).toMatchObject({ name: "Nom de l'entreprise", hubspotId: "Record ID", headcount: "Nombre d'employés", lifecycle: "Phase du cycle de vie", parent: "Entreprise parente" });
  });

  it("reconnaît un export HubSpot contacts en anglais", () => {
    const m = autoMap(["Record ID", "First Name", "Last Name", "Email", "Job Title", "Associated Company", "Associated Company IDs"], "contacts");
    expect(m).toMatchObject({ firstName: "First Name", lastName: "Last Name", email: "Email", title: "Job Title", companyName: "Associated Company", companyHubspotId: "Associated Company IDs", hubspotId: "Record ID" });
  });

  it("lit les valeurs au format français", () => {
    expect(parseIntLoose("2 300")).toBe(2300);
    expect(parseIntLoose("1,200")).toBe(1200);
    expect(parseIntLoose("1000-4999")).toBe(1000);
    expect(parseSiren("552 100 554 00010")).toBe("552100554");
    expect(parseDateLoose("05/03/2024")).toEqual(new Date(2024, 2, 5));
    expect(isCustomerValue("Client")).toBe(true);
    expect(isCustomerValue("Opportunité")).toBe(false);
  });

  it("rattache NAF et libellés au référentiel des secteurs", () => {
    expect(sectorFromNaf("30.30Z")).toBe("Aéronautique");
    expect(sectorFromNaf("62.02A")).toBe("IT / Telecom");
    expect(sectorFromNaf("21.20Z")).toBe("Industrie Pharma");
    expect(sectorFromLabel("COMPUTER_SOFTWARE")).toBe("IT / Telecom");
    expect(sectorFromLabel("Pharmaceuticals")).toBe("Industrie Pharma");
    expect(sectorFromLabel("Banque")).toBe("Banque");
  });
});
