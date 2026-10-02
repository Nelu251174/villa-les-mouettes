"use client";

import { useEffect, useState } from "react";

type Item = { href: string; label: string };

/** Meniu pentru telefon: buton cu 3 linii care deschide lista de sectiuni + butonul de disponibilitate. Pe desktop e ascuns din CSS. */
export default function MobileMenu({ items, cta, label }: { items: Item[]; cta: Item; label: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="burger" aria-expanded={open} aria-controls="mobile-menu" aria-label={label} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true" className={open ? "bars open" : "bars"} />
      </button>
      <div id="mobile-menu" className="mobile-menu" hidden={!open}>
        {items.map((i) => (
          <a key={i.href} href={i.href} onClick={() => setOpen(false)}>{i.label}</a>
        ))}
        <a href={cta.href} className="btn btn-primary" onClick={() => setOpen(false)}>{cta.label}</a>
      </div>
    </>
  );
}
