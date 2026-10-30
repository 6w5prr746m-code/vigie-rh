import Link from "next/link";
import { prisma } from "@/lib/db";
import { RIVALS, fnFamily } from "@/lib/referentiels";
import { toQuery, type Filters } from "@/lib/filters";
import { fmt, fmtDate, formatSiren } from "@/lib/format";
import { Pill, structLine } from "./ui";
import StarButton from "./StarButton";
import { AddContactForm, CustomerButton, DrawerClose, ExcludeButton, HubspotButton, ToolFeedback } from "./DrawerClient";

const Dots = ({ n }: { n: number }) => (
  <span className="dots" aria-label={`Confiance ${n} sur 5`}>
    {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? "on" : ""} />)}
  </span>
);

export default async function CompanyDrawer({ id, f, path }: { id: string; f: Filters; path: string }) {
  const c = await prisma.company.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { fullName: "asc" } },
      tools: { orderBy: [{ category: "asc" }, { confidence: "desc" }] },
      signals: { orderBy: { date: "desc" }, take: 30 },
      followed: true,
      _count: { select: { signals: true } },
    },
  });
  const closeHref = `${path}${toQuery(f, { fiche: null })}`;
  if (!c) return null;

  const parts: [string, number][] = JSON.parse(c.scoreParts || "[]");
  const families = new Map<string, typeof c.contacts>();
  for (const p of c.contacts) {
    const fam = p.functionFamily ?? fnFamily(p.function) ?? "Autres fonctions";
    families.set(fam, [...(families.get(fam) ?? []), p]);
  }
  const toolsByCat = new Map<string, typeof c.tools>();
  for (const t of c.tools) toolsByCat.set(t.category, [...(toolsByCat.get(t.category) ?? []), t]);

  return (
    <>
      <Link className="scrim" href={closeHref} scroll={false} aria-label="Fermer la fiche" tabIndex={-1} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="dTitle">
        <div className="dhead">
          <div>
            <h2 id="dTitle">{c.name}</h2>
            <div className="sub">{[c.activity, c.sector, c.city].filter(Boolean).join(" · ")}</div>
          </div>
          <DrawerClose href={closeHref} />
        </div>
        <div className="actions">
          <StarButton id={c.id} name={c.name} followed={!!c.followed} asButton />
          <HubspotButton />
          <CustomerButton id={c.id} closeHref={closeHref} />
          <ExcludeButton id={c.id} closeHref={closeHref} />
        </div>
        <div className="facts">
          <div className="fact"><div className="k">Effectif entité</div><div className="v num">{fmt(c.headcount)}</div></div>
          <div className="fact"><div className="k">Effectif groupe</div><div className="v num">{fmt(c.groupHeadcount)}</div></div>
          <div className="fact"><div className="k">Structure</div><div className="v">{structLine(c)}</div></div>
          <div className="fact"><div className="k">SIREN</div><div className="v num">{formatSiren(c.siren)}</div></div>
          {(c.isPublic || c.foreignGroup) && (
            <div className="fact"><div className="k">Statut</div><div className="v">{[c.isPublic && "Public", c.foreignGroup && "Groupe étranger"].filter(Boolean).join(" · ")}</div></div>
          )}
        </div>

        <section>
          <h3>Score de priorité · {c.scoreTotal}/100</h3>
          <div className="why">{parts.map(([l, v]) => <div key={l}><span>{l}</span><b className="num">+{v}</b></div>)}</div>
        </section>

        <section>
          <h3>Outils en place</h3>
          {c.tools.length === 0 && <p className="sub">Aucun outil identifié.</p>}
          {[...toolsByCat].map(([cat, list]) => list.map((t) => (
            <div key={t.id} className="toolrow">
              <span>
                <span className="sub">{cat}</span><br />
                <b>{t.tool}</b>{RIVALS.has(t.tool) && <> <span className="pill p-dep">Concurrent</span></>}<Dots n={t.confidence} />
                <span className="sub"> · {t.source}{t.mentions > 1 ? `, ${t.mentions} mentions` : ""}</span>
              </span>
              {t.feedback ? <span className="sub">{t.feedback === "ok" ? "Confirmé par vous" : "Signalé comme faux"}</span> : <ToolFeedback toolId={t.id} />}
            </div>
          )))}
        </section>

        <section>
          <h3>Qui appeler · {c.contacts.length}</h3>
          {c.contacts.length === 0 && <p className="sub">Aucun contact. Importez un export HubSpot ou ajoutez-en un ci-dessous.</p>}
          {[...families].map(([fam, ps]) => (
            <div key={fam}>
              <div className="sub" style={{ marginTop: 8, textTransform: "uppercase", letterSpacing: ".06em", fontSize: 11 }}>{fam}</div>
              {ps.map((p) => (
                <div key={p.id} className="person">
                  <span><b>{p.fullName}</b><br /><span className="sub">{p.function ?? p.rawTitle ?? "Fonction inconnue"}{p.since ? ` · depuis ${fmtDate(p.since)}` : ""}</span></span>
                  {p.email && <span className="mail">{p.email}</span>}
                </div>
              ))}
            </div>
          ))}
          <AddContactForm companyId={c.id} />
        </section>

        <section>
          <h3>Signaux · {c._count.signals}</h3>
          {c.signals.length === 0 && <p className="sub">Aucun signal.</p>}
          {c.signals.map((s) => (
            <div key={s.id} className="sig">
              <div><Pill type={s.type} /> <span className="theme">{s.theme ?? s.function}</span> <span className="date num" style={{ float: "right" }}>{fmtDate(s.date)}</span></div>
              <div>{s.summary} {s.url && <a className="sub" href={s.url} target="_blank" rel="noopener noreferrer">source ↗</a>}</div>
            </div>
          ))}
        </section>
      </aside>
    </>
  );
}
