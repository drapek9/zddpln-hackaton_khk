import { useState } from "react";
import { ApiUnavailable, type AiText } from "../lib/api";

type Props = {
  /** Popisek tlačítka, např. „Zdůvodnit výběr“. */
  label: string;
  /** Volání /api/ai/*. Spouští se až kliknutím, nic se neukládá. */
  load: () => Promise<AiText>;
  /** Bez přihlášeného úředníka server odpoví 401, proto tlačítko rovnou vysvětlí proč nejde. */
  enabled: boolean;
};

// Návrh AI (kap. 21, F7): vždy označený, nikdy nemění skóre ani pořadí, rozhoduje člověk.
export default function AiSuggest({ label, load, enabled }: Props) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [result, setResult] = useState<AiText | null>(null);
  const [error, setError] = useState("");

  const run = async () => {
    setState("busy");
    setError("");
    try {
      setResult(await load());
      setState("done");
    } catch (err) {
      setError(
        err instanceof ApiUnavailable
          ? "Server teď neběží, návrh nejde načíst."
          : "Návrh se nepodařilo načíst. Zkuste to za chvíli.",
      );
      setState("error");
    }
  };

  return (
    <div className="ai-note">
      <div className="ai-head">
        <span className="ai-tag">{result ? result.label : "návrh AI"}</span>
        {enabled ? (
          <button className="btn small" onClick={run} disabled={state === "busy"}>
            {state === "busy" ? "Píšu…" : result ? "Znovu" : label}
          </button>
        ) : null}
      </div>
      {!enabled && <p>Návrh AI je pro přihlášeného úředníka (v ukázce bez účtu není).</p>}
      {state === "error" && <p>{error}</p>}
      {result && <p className="ai-text">{result.text}</p>}
      {result && (
        <p className="fine">
          {result.source === "ai" ? "Text napsala AI jen z čísel výpočtu." : "AI je vypnutá, text je ze šablony."} Pořadí
          nemění, rozhoduje člověk.
        </p>
      )}
    </div>
  );
}
