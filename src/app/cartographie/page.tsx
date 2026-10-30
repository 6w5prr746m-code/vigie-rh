import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { companyWhere, contactWhere, parseFilters, toQuery, type Filters, type RawParams } from "@/lib/filters";
import { fnFamily } from "@/lib/referentiels";
import { fmt, fmtDate, rel } from "@/lib/format";
import { clampPage, excludedList } from "@/lib/queries";
import FilterRail from "@/components/FilterRail";
import ViewHeader from "@/components/ViewHeader";
import CompanyDrawer from "@/components/CompanyDrawer";
import StarButton from "@/components/StarButton";
import { CompanyLink, Pager, ScoreCell, SortTh, ToolsCell, structLine } from "@/components/ui";

const PATH = "/cartographie";

function Toggle({ f }: { f: Filters }) {
  const href = (carto: Filters["carto"]) => `${PATH}${toQuery(f, { carto, page: 1, sort: null, fiche: null })}`;
  return (
    <div className="seg" role="group" aria-label="Vue" style={{ marginTop: 0 }}>
      <Link href={href("entreprises")} aria-pressed={f.carto === "entreprises"} role="button" className="segbtn">Entreprises</Link>
      <Link href={href("contacts")} aria-pressed={f.carto === "contacts"} role="button" className="segbtn">Contacts</Link>
    </div>
  );
}

export default async function CartographiePage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const f = parseFilters(await searchParams);
  const excluded = await excludedList();
  const dir = f.dir === 1 ? "asc" : "desc";

  if (f.carto === "contacts") {
    const where = contactWhere(f);
    const orderBy: Prisma.ContactOrderByWithRelationInput[] =
      f.sort === "since" ? [{ since: { sort: dir, nulls: "last" } }] : f.sort === "co" ? [{ company: { name: dir } }, { fullName: "asc" }] : [{ fullName: f.sort === "name" ? dir : "asc" }];
    const total = await prisma.contact.count({ where });
    const page = clampPage(f.page, f.per, total);
    const rows = await prisma.contact.findMany({ where, orderBy, skip: (page - 1) * f.per, take: f.per, include: { company: { select: { id: true, name: true } } } });
    const pf = { ...f, page };
    return (
      <div className="wrap">
        <FilterRail f={f} mode="contacts" excluded={excluded} />
        <main>
          <ViewHeader title="Cartographie" sub={`${fmt(total)} contacts dans votre périmètre`} f={f}><Toggle f={f} /></ViewHeader>
          <div className="tablebox">
            <table>
              <thead><tr><SortTh f={f} path={PATH} k="name" label="Contact" /><th>Fonction</th><SortTh f={f} path={PATH} k="co" label="Entreprise" /><SortTh f={f} path={PATH} k="since" label="En poste depuis" /><th>E-mail</th><th>Source</th></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.fullName}</b></td>
                    <td>{p.function ?? p.rawTitle ?? "—"}<div className="sub">{p.functionFamily ?? fnFamily(p.function) ?? ""}</div></td>
                    <td><CompanyLink f={pf} path={PATH} id={p.company.id} name={p.company.name} /></td>
                    <td className="date num">{fmtDate(p.since)}</td>
                    <td>{p.email ? <span className="sub" style={{ fontFamily: "var(--f-mono)", userSelect: "all" }}>{p.email}</span> : <span className="sub">—</span>}</td>
                    <td className="sub">{p.source}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="empty">Aucun contact ne correspond.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager f={pf} path={PATH} total={total} />
        </main>
        {f.fiche && <CompanyDrawer id={f.fiche} f={pf} path={PATH} />}
      </div>
    );
  }

  const where = companyWhere(f, { recency: true });
  const orderBy: Prisma.CompanyOrderByWithRelationInput[] =
    f.sort === "name" ? [{ name: dir }]
    : f.sort === "eff" ? [{ headcount: { sort: dir, nulls: "last" } }]
    : f.sort === "last" ? [{ lastSignalAt: { sort: dir, nulls: "last" } }]
    : [{ scoreTotal: f.sort === "score" ? dir : "desc" }, { name: "asc" }];
  const total = await prisma.company.count({ where });
  const page = clampPage(f.page, f.per, total);
  const rows = await prisma.company.findMany({
    where, orderBy, skip: (page - 1) * f.per, take: f.per,
    include: {
      tools: { where: { OR: [{ feedback: null }, { feedback: { not: "ko" } }] }, select: { tool: true }, orderBy: { confidence: "desc" } },
      followed: { select: { companyId: true } },
      _count: { select: { contacts: true } },
    },
  });
  const pf = { ...f, page };
  return (
    <div className="wrap">
      <FilterRail f={f} mode="comptes" excluded={excluded} />
      <main>
        <ViewHeader title="Cartographie" sub={`${fmt(total)} entreprises dans votre périmètre`} f={f}><Toggle f={f} /></ViewHeader>
        <div className="tablebox">
          <table>
            <thead><tr><th></th><SortTh f={f} path={PATH} k="name" label="Entreprise" /><SortTh f={f} path={PATH} k="eff" label="Effectif" /><th>Outils en place</th><th>Contacts</th><th>Groupe</th><SortTh f={f} path={PATH} k="score" label="Priorité" /><SortTh f={f} path={PATH} k="last" label="Dernier signal" /></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td><StarButton id={c.id} name={c.name} followed={!!c.followed} /></td>
                  <td><CompanyLink f={pf} path={PATH} id={c.id} name={c.name} /><div className="sub">{[c.sector, c.activity].filter(Boolean).join(" · ")}</div></td>
                  <td className="num">{fmt(c.headcount)}</td>
                  <td><ToolsCell tools={c.tools} /></td>
                  <td className="num">{c._count.contacts}</td>
                  <td className="sub">{structLine(c)}<br />groupe : {fmt(c.groupHeadcount)}</td>
                  <td><ScoreCell total={c.scoreTotal} /></td>
                  <td className="date">{rel(c.lastSignalAt)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="empty">Aucune entreprise ne correspond.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager f={pf} path={PATH} total={total} />
      </main>
      {f.fiche && <CompanyDrawer id={f.fiche} f={pf} path={PATH} />}
    </div>
  );
}
