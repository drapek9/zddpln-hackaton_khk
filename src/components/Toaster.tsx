import { useEffect, useState } from "react";

// Krátká potvrzení akcí („Uloženo“, „Připíchnuto“). Kdokoli zavolá toast("…"), Toaster v App je ukáže.
const EVENT = "cesty-khk:toast";

type Item = { id: number; text: string; tone: "ok" | "warn" };

export function toast(text: string, tone: Item["tone"] = "ok") {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, tone } }));
}

export default function Toaster() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let seq = 0;
    const onToast = (e: Event) => {
      const { text, tone } = (e as CustomEvent<{ text: string; tone: Item["tone"] }>).detail;
      const id = ++seq;
      setItems((list) => [...list.slice(-2), { id, text, tone }]);
      window.setTimeout(() => setItems((list) => list.filter((x) => x.id !== id)), 2600);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
