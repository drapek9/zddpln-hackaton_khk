import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

// Jednoduchý modální dialog: Esc nebo klik mimo zavře, fokus jde dovnitř.
export default function Dialog({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // onClose bývá nová funkce při každém vykreslení; fokus chceme nastavit jen jednou.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    (ref.current?.querySelector<HTMLElement>("button.primary") ?? ref.current?.querySelector<HTMLElement>("textarea"))?.focus();
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="dialog-head">
          <h3>{title}</h3>
          <button className="sheet-close" onClick={onClose} aria-label="Zavřít">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
