import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseFilters, signalWhere, toQuery, type RawParams } from "@/lib/filters";
import { SIGNAL_TYPES } from "@/lib/referentiels";
import { fmt, fmtDate } from "@/lib/format";
import { clampPage, excludedList } from "@/lib/queries";
import FilterRail from "@/components/FilterRail";
import ViewHeader from "@/components/ViewHeader";
import CompanyDrawer from "@/components/CompanyDrawer";
import StarButton from "@/components/StarButton";
import { CompanyLink, Pager, Pill, SortTh } from "@/components/ui";

const PATH = "/signaux";

export default async function SignauxPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const f = parseFilters(await searchParams);
  const where = signalWhere(f);
  const dir = f.dir === 1 ? "asc" : "desc";
  const orderBy: Prisma.SignalOrderByWithRelationInput[] =
    f.sort === "co" ? [{ company: { name: dir } }, { date: "desc" }] : f.sort === "type" ? [{ type: dir }, { date: "desc" }] : [{ date: f.sort === "date" ? dir : "desc" }];

  const [byType, total, excluded] = await Promise.all([
    prisma.signal.groupBy({ by: ["type"], where: signalWhere(f, { ignoreTypes: true }), _count: { _all: true } }),
    prisma.signal.count({ where }),
    excludedList(),
  ]);
  const page = clampPage(f.page, f.per, total);
  const rows = await prisma.signal.findMany({
    where, orderBy, skip: (page - 1) * f.per, take: f.per,
    include: { company: { select: { id: true, name: true, sector: true, headcount: true, followed: { select: { companyId: true } } } } },
  });
  const counts = Object.fromEntries(byType.map((g) => [g.type, g._count._all]));
  const all = byType.reduce((a, g) => a + g._count._all, 0);
  const pf = { ...f, page };
  const typeHref = (t: string | null) =>
    `${PATH}${toQuery(f, { page: 1, types: t === null ? [] : f.types.includes(t) ? f.types.filter((x) => x !== t) : [...f.types, t] })}`;

  return (
    <div className="wrap">
      <FilterRail f={f} mode="signaux" excluded={excluded} />
      <main>
        <ViewHeader title="Signaux & actualités" sub={`${fmt(total)} signaux sur votre périmètre`} f={f} />
        <div className="types" role="group" aria-label="Types de signaux">
          <Link className="type-chip" href={typeHref(null)} aria-pressed={!f.types.length} scroll={false} style={{ color: "inherit", textDecoration: "none" }}>Tous <b className="num">{fmt(all)}</b></Link>
          {Object.entries(SIGNAL_TYPES).map(([k, t]) => (
            <Link key={k} className="type-chip" href={typeHref(k)} aria-pressed={f.types.includes(k)} scroll={false} style={{ color: "inherit", textDecoration: "none" }}>
              <span className={`pill ${t.c}`}>{t.l}</span><b className="num">{fmt(counts[k] ?? 0)}</b>
            </Link>
          ))}
        </div>
        <div className="tablebox">
          <table>
            <thead><tr><th></th><SortTh f={f} path={PATH} k="co" label="Entreprise" /><SortTh f={f} path={PATH} k="type" label="Type" /><th>Preuve</th><th>Fonction ou thème</th><SortTh f={f} path={PATH} k="date" label="Date" /></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><StarButton id={s.company.id} name={s.company.name} followed={!!s.company.followed} /></td>
                  <td><CompanyLink f={pf} path={PATH} id={s.company.id} name={s.company.name} /><div className="sub">{[s.company.sector, s.company.headcount != null && `${fmt(s.company.headcount)} sal.`].filter(Boolean).join(" · ")}</div></td>
                  <td><Pill type={s.type} /></td>
                  <td>{s.summary} {s.url && <a className="sub" href={s.url} target="_blank" rel="noopener noreferrer">source ↗</a>}</td>
                  <td className="theme">{s.theme ?? s.function}</td>
                  <td className="date num">{fmtDate(s.date)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="empty">Aucun signal ne correspond à ces filtres. Élargissez la période ou retirez un thème.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager f={pf} path={PATH} total={total} />
      </main>
      {f.fiche && <CompanyDrawer id={f.fiche} f={pf} path={PATH} />}
    </div>
  );
}
