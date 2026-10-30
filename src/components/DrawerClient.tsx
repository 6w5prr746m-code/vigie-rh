"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { addContact, excludeCompany, markCustomer, setToolFeedback } from "@/app/actions";
import { toast } from "./Toaster";

/** Fermeture du tiroir : fond cliquable, bouton, touche Échap. */
export function DrawerClose({ href }: { href: string }) {
  const router = useRouter();
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") router.replace(href, { scroll: false }); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [href, router]);
  return <Link ref={ref} className="btn small" href={href} scroll={false}>Fermer</Link>;
}

export function ExcludeButton({ id, closeHref }: { id: string; closeHref: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn small" disabled={pending} onClick={() => start(async () => {
      await excludeCompany(id);
      router.replace(closeHref, { scroll: false });
      toast("Compte retiré de votre périmètre");
    })}>Exclure du périmètre</button>
  );
}

export function HubspotButton() {
  return <button type="button" className="btn small primary" onClick={() => toast("La création dans HubSpot arrive à l'étape 3")}>Créer dans HubSpot</button>;
}

export function ToolFeedback({ toolId }: { toolId: string }) {
  const [pending, start] = useTransition();
  const send = (v: "ok" | "ko") => start(async () => {
    await setToolFeedback(toolId, v);
    toast(v === "ok" ? "Outil confirmé" : "Merci, l'outil est signalé à corriger");
  });
  return (
    <span className="actions">
      <button type="button" className="btn small" disabled={pending} onClick={() => send("ok")}>Confirmer</button>
      <button type="button" className="btn small" disabled={pending} onClick={() => send("ko")}>Corriger</button>
    </span>
  );
}

export function CustomerButton({ id, closeHref }: { id: string; closeHref: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn small" disabled={pending} onClick={() => start(async () => {
      await markCustomer(id);
      router.replace(closeHref, { scroll: false });
      toast("Compte marqué client signé et retiré du périmètre");
    })}>Client signé</button>
  );
}

export function AddContactForm({ companyId }: { companyId: string }) {
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  const details = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={details} style={{ marginTop: 8 }}>
      <summary className="sub" style={{ cursor: "pointer" }}>+ Ajouter un contact</summary>
      <form ref={ref} className="addform" action={(fd) => start(async () => {
        const r = await addContact(companyId, fd);
        if (r?.error) return toast(r.error);
        ref.current?.reset();
        if (details.current) details.current.open = false;
        toast("Contact ajouté");
      })}>
        <input name="fullName" placeholder="Prénom Nom" required aria-label="Nom" />
        <input name="title" placeholder="Intitulé du poste" aria-label="Intitulé du poste" />
        <input name="email" type="email" placeholder="E-mail (facultatif)" aria-label="E-mail" />
        <label className="sub">En poste depuis <input name="since" type="date" aria-label="En poste depuis" /></label>
        <button type="submit" className="btn small primary" disabled={pending}>Ajouter</button>
      </form>
    </details>
  );
}
