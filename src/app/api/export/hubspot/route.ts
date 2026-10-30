// Export CSV au format attendu par l'assistant d'import HubSpot (vos données, hors démo), selon les filtres de la Cartographie.
import { prisma } from "@/lib/db";
import { companyWhere, contactWhere, parseFilters } from "@/lib/filters";
import { SIGNAL_TYPES, type SignalType } from "@/lib/referentiels";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const f = parseFilters(Object.fromEntries(sp));
  const day = new Date().toISOString().slice(0, 10);

  if (sp.get("type") === "contacts") {
    const rows = await prisma.contact.findMany({
      where: { AND: [contactWhere(f), { isDemo: false }] },
      include: { company: { select: { name: true, domain: true } } },
      orderBy: [{ company: { name: "asc" } }, { fullName: "asc" }],
    });
    const csv = toCsv(
      ["First Name", "Last Name", "Email", "Job Title", "Company Name", "Company Domain Name", "Fonction Vigie RH"],
      rows.map((p) => {
        const [first, ...rest] = p.fullName.split(" ");
        return [p.firstName ?? first, p.lastName ?? rest.join(" "), p.email, p.rawTitle ?? p.function, p.company.name, p.company.domain, p.function];
      }),
    );
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="vigie-rh-contacts-hubspot-${day}.csv"` } });
  }

  const rows = await prisma.company.findMany({
    where: { AND: [companyWhere(f, { recency: true }), { isDemo: false }] },
    include: { signals: { orderBy: { date: "desc" }, take: 3 } },
    orderBy: { scoreTotal: "desc" },
  });
  const csv = toCsv(
    ["Company name", "Company Domain Name", "Number of Employees", "City", "SIREN", "Secteur Vigie RH", "Score Vigie RH", "Derniers signaux Vigie RH"],
    rows.map((c) => [
      c.name, c.domain, c.headcount, c.city, c.siren, c.sector, c.scoreTotal,
      c.signals.map((s) => `${s.date.toISOString().slice(0, 10)} ${SIGNAL_TYPES[s.type as SignalType]?.l ?? s.type} : ${s.summary}`).join(" | "),
    ]),
  );
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="vigie-rh-entreprises-hubspot-${day}.csv"` } });
}
