"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/signaux", label: "Signaux" },
  { href: "/cartographie", label: "Cartographie" },
  { href: "/priorites", label: "Priorités" },
  { href: "/suivis", label: "Mes comptes suivis", badge: true },
  { href: "/importer", label: "Importer" },
];
const SKINS = [["apple", "Apple"], ["instagram", "Instagram"], ["vigie", "Vigie"]] as const;

const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem("vigie." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem("vigie." + k, JSON.stringify(v)); } catch {} },
};

export default function AppBar({ hasDemo, freshCount = 0 }: { hasDemo: boolean; freshCount?: number }) {
  const path = usePathname();
  const [skin, setSkin] = useState("apple");
  useEffect(() => setSkin(store.get("skin", "apple")), []);

  const applySkin = (s: string) => { document.documentElement.dataset.skin = s; store.set("skin", s); setSkin(s); };
  const toggleMode = () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    store.set("mode", root.dataset.theme);
  };

  return (
    <header className="bar">
      <div className="brand"><i aria-hidden="true"></i>Vigie RH</div>
      <nav className="nav" aria-label="Sections">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={path.startsWith(n.href) ? "page" : undefined}>
            {n.label}
            {n.badge && freshCount > 0 && <span className="badge num">{freshCount}</span>}
          </Link>
        ))}
      </nav>
      <span className="spacer" />
      <Link href="/reglages" className="modebtn" aria-label="Réglages" title="Réglages">⚙</Link>
      <div className="skins" role="group" aria-label="Thème">
        {SKINS.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={skin === k} onClick={() => applySkin(k)}>{l}</button>
        ))}
      </div>
      <button type="button" className="modebtn" aria-label="Basculer clair / sombre" onClick={toggleMode}>◐</button>
      {hasDemo && <span className="demo" title="Entreprises, contacts et signaux fictifs (npm run db:purge-demo pour les supprimer)">Données de démo</span>}
    </header>
  );
}
