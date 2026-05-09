import { useScenarioContext } from "./ScenarioProvider.js";

export interface ScenarioRefsProps {
  onRefClick: (canonicalKey: string, docId?: string) => void;
  className?: string;
}

export function ScenarioRefs({ onRefClick, className }: ScenarioRefsProps) {
  const { scenario, audit, activeProductId } = useScenarioContext();
  const hints = scenario.rendering_hints;
  const productSpec = hints?.product_specs?.find((p) => p.product_id === activeProductId);
  const agency = productSpec?.agency ?? null;

  const filteredAudit = agency
    ? audit.filter((a) => a.spec_name?.startsWith(agency + "_"))
    : [];

  const refs: Array<{ label: string; canonicalKey: string; docId?: string }> = [];
  const seen = new Set<string>();
  for (const spec of filteredAudit) {
    for (const step of spec.steps ?? []) {
      for (const fc of step.function_calls ?? []) {
        const args = fc.args as Record<string, unknown> | null | undefined;
        if (!args) continue;
        const docType = (args.doc_type as string) ?? "";
        const canonicalKey = (args.canonical_key as string) ?? (args.key as string) ?? "";
        if (!canonicalKey) continue;
        const label = docType ? `${docType}.${canonicalKey}` : canonicalKey;
        if (seen.has(label)) continue;
        seen.add(label);
        refs.push({ label, canonicalKey, docId: args.doc_id as string | undefined });
      }
    }
  }

  if (refs.length === 0) {
    return (
      <div className={className} style={{ padding: "1rem", color: "#64748b", fontSize: "0.875rem" }}>
        No references for this product.
      </div>
    );
  }

  return (
    <div className={className} style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", padding: "0.75rem" }}>
      {refs.map((ref) => (
        <button
          key={ref.label}
          onClick={() => onRefClick(ref.canonicalKey, ref.docId)}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.25rem",
            padding: "0.25rem 0.625rem", borderRadius: "0.375rem",
            background: "#eff6ff", border: "1px solid #bfdbfe",
            color: "#1d4ed8", fontSize: "0.75rem", fontFamily: "monospace", cursor: "pointer",
          }}
        >
          {ref.label}
        </button>
      ))}
    </div>
  );
}
