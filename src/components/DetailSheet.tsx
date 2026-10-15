import { toast } from "./Toaster";
import { useEffect, useRef, useState, type ReactNode, type TouchEvent, type WheelEvent } from "react";

type Props = {
  /** Mění se s vybraným úsekem: nový úsek začne v náhledu. */
  id: string | number;
  onClose: () => void;
  /** Sdílitelný odkaz na úsek (kap. 25.1): tlačítko ho zkopíruje. */
  shareUrl?: string;
  children: ReactNode;
};

// Detail jako v mapových aplikacích: dole nad mapou je pruh s náhledem,
// posunem kolečka dolů (nebo klikem na úchyt) se vysune, posunem nahoru na začátku obsahu se zase stáhne.
export default function DetailSheet({ id, onClose, shareUrl, children }: Props) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
    bodyRef.current?.scrollTo({ top: 0 });
  }, [id]);

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const body = bodyRef.current;
    if (!body) return;
    // React má wheel pasivní, takže bez preventDefault. V náhledu obsah stejně neroluje.
    if (!open && e.deltaY > 0) {
      setOpen(true);
    } else if (open && e.deltaY < 0 && body.scrollTop <= 0) {
      setOpen(false);
    }
  };

  // Telefon: tah prstem nahoru vysune, dolů na začátku obsahu stáhne.
  const touchY = useRef<number | null>(null);
  const onTouchStart = (e: TouchEvent<HTMLElement>) => (touchY.current = e.touches[0].clientY);
  const onTouchEnd = (e: TouchEvent<HTMLElement>) => {
    if (touchY.current == null) return;
    const dy = e.changedTouches[0].clientY - touchY.current;
    touchY.current = null;
    if (dy < -40 && !open) setOpen(true);
    else if (dy > 40 && open && (bodyRef.current?.scrollTop ?? 0) <= 0) setOpen(false);
  };

  return (
    <section
      className={`detail-sheet ${open ? "open" : ""}`}
      aria-label="Detail úseku"
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="sheet-head">
        <button
          className="sheet-grip"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? "Stáhnout detail" : "Vysunout detail"}
          title={open ? "Stáhnout (nebo kolečkem nahoru)" : "Vysunout (nebo kolečkem dolů)"}
        />
        {shareUrl && (
          <button
            className="sheet-share"
            title="Zkopírovat odkaz na tento úsek"
            onClick={() =>
              navigator.clipboard?.writeText(shareUrl).then(
                () => toast("Odkaz na úsek zkopírován"),
                () => toast(shareUrl),
              ) ?? toast(shareUrl)
            }
          >
            Kopírovat odkaz
          </button>
        )}
        <button className="sheet-close" onClick={onClose} aria-label="Zavřít detail" title="Zavřít">
          ×
        </button>
      </div>
      <div className="sheet-body" ref={bodyRef}>
        {children}
      </div>
      {!open && (
        <button className="sheet-more" onClick={() => setOpen(true)}>
          Zobrazit detail ↓
        </button>
      )}
    </section>
  );
}
