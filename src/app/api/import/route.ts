// POST multipart : file, kind, mode=preview|run, mapping (JSON), createMissing
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { parseFile } from "@/lib/import/parse";
import { autoMap, mappingError, FIELDS, type ImportKind, type Mapping } from "@/lib/import/mapping";
import { runImport } from "@/lib/import/run";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const kind = String(form.get("kind")) as ImportKind;
    if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
    if (!FIELDS[kind]) return NextResponse.json({ error: "Type d'import inconnu." }, { status: 400 });
    const table = await parseFile(Buffer.from(await file.arrayBuffer()), file.name);
    if (!table.headers.length) return NextResponse.json({ error: "Fichier vide ou illisible." }, { status: 400 });

    if (form.get("mode") !== "run") {
      return NextResponse.json({ headers: table.headers, mapping: autoMap(table.headers, kind), sample: table.rows.slice(0, 3), rowCount: table.rows.length });
    }
    const mapping = JSON.parse(String(form.get("mapping") || "{}")) as Mapping;
    const err = mappingError(kind, mapping);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    const report = await runImport(kind, table.rows, mapping, { createMissingCompanies: form.get("createMissing") === "1", fileName: file.name });
    revalidatePath("/", "layout");
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
