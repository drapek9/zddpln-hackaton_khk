export type Sheet = "left" | "map" | "right";

type Props = {
  value: Sheet;
  onChange: (next: Sheet) => void;
  left: string;
  right?: string;
};

// Mobil: přepínání mezi levým panelem, mapou a detailem (panely se vysouvají zdola).
export default function SheetBar({ value, onChange, left, right }: Props) {
  const items: [Sheet, string][] = [
    ["left", left],
    ["map", "Mapa"],
    ...(right ? ([["right", right]] as [Sheet, string][]) : []),
  ];
  return (
    <div className="sheet-bar" role="tablist">
      {items.map(([key, label]) => (
        <button
          key={key}
          role="tab"
          aria-selected={value === key}
          className={value === key ? "on" : ""}
          onClick={() => onChange(value === key && key !== "map" ? "map" : key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Na mobilu po výběru úseku rovnou otevřít detail. */
export const isNarrow = () => window.matchMedia?.("(max-width: 900px)").matches ?? false;
