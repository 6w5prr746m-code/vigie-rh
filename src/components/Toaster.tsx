"use client";
import { useEffect, useState } from "react";

export function toast(message: string) {
  window.dispatchEvent(new CustomEvent("vigie:toast", { detail: message }));
}

export default function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => { setMsg((e as CustomEvent<string>).detail); clearTimeout(t); t = setTimeout(() => setMsg(null), 2600); };
    window.addEventListener("vigie:toast", on);
    return () => window.removeEventListener("vigie:toast", on);
  }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}
