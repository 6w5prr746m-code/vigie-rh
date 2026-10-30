"use client";
import { useOptimistic, useTransition } from "react";
import { toggleFollow } from "@/app/actions";
import { toast } from "./Toaster";

export default function StarButton({ id, name, followed, asButton }: { id: string; name: string; followed: boolean; asButton?: boolean }) {
  const [on, setOn] = useOptimistic(followed);
  const [, start] = useTransition();
  const click = () =>
    start(async () => {
      setOn(!on);
      const now = await toggleFollow(id);
      toast(now ? `${name} ajouté à vos comptes suivis` : `${name} retiré de vos comptes suivis`);
    });
  return (
    <button type="button" className={asButton ? "btn small star" : "star"} aria-pressed={on} aria-label={`${on ? "Ne plus suivre" : "Suivre"} ${name}`} onClick={click}>
      ★{asButton ? (on ? " Suivi" : " Suivre") : ""}
    </button>
  );
}
