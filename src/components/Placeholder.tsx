export default function Placeholder({ title, sub, step }: { title: string; sub: string; step: string }) {
  return (
    <div className="wrap">
      <aside className="rail" aria-label="Filtres"><h2>Filtres</h2></aside>
      <main>
        <div className="head"><div><h1>{title}</h1><p>{sub}</p></div></div>
        <div className="placeholder">Écran branché à l&apos;{step}.</div>
      </main>
    </div>
  );
}
