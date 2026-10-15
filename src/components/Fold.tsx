import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  /** Krátký údaj vpravo v hlavičce, třeba počet položek. */
  meta?: ReactNode;
  open?: boolean;
  children: ReactNode;
};

// Rozbalovací sekce v bočních panelech (nativní <details>, funguje i z klávesnice).
export default function Fold({ title, meta, open = false, children }: Props) {
  return (
    <details className="fold" open={open}>
      <summary>
        <span>{title}</span>
        {meta != null && <small>{meta}</small>}
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}
