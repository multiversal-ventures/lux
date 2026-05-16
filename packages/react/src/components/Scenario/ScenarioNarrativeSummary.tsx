import type { CSSProperties } from "react";
import type {
  VeritasSummarySection,
  VeritasSummaryItem,
  VeritasSummaryEvalResponse,
} from "@multiversal-ventures/lux-core";

const SEVERITY_BORDER: Record<string, string> = {
  default: "#e2e8f0",
  warning: "#f59e0b",
  danger: "#dc2626",
  success: "#059669",
};

const SEVERITY_BG: Record<string, string> = {
  default: "#f8fafc",
  warning: "#fffbeb",
  danger: "#fef2f2",
  success: "#f0fdf4",
};

const SEVERITY_TEXT: Record<string, string> = {
  default: "#475569",
  warning: "#92400e",
  danger: "#991b1b",
  success: "#065f46",
};

function ItemRow({ item }: { item: VeritasSummaryItem }) {
  const color = SEVERITY_TEXT[item.severity ?? "default"] ?? SEVERITY_TEXT.default;

  const valueStyle: CSSProperties = {
    fontWeight: 600,
    color,
    whiteSpace: "nowrap",
    marginLeft: "0.5rem",
  };

  const detailStyle: CSSProperties = {
    margin: "0.125rem 0 0",
    fontSize: "0.8125rem",
    color: "#64748b",
    lineHeight: 1.5,
  };

  const rowStyle: CSSProperties = {
    padding: "0.5rem 0.75rem",
    borderBottom: "1px solid #f1f5f9",
  };

  if (item.type === "income_source") {
    return (
      <div style={rowStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "#1e293b" }}>{item.label}</span>
          {item.value && <span style={valueStyle}>{item.value}</span>}
        </div>
        <p style={detailStyle}>{item.detail}</p>
      </div>
    );
  }

  if (item.type === "trend") {
    const isDown = item.value?.startsWith("-");
    const trendColor = item.severity === "danger" ? "#dc2626" : item.severity === "warning" ? "#d97706" : "#059669";
    return (
      <div style={rowStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "#1e293b" }}>{item.label}</span>
          {item.value && (
            <span style={{ fontWeight: 600, color: trendColor, whiteSpace: "nowrap", marginLeft: "0.5rem" }}>
              {isDown ? "▼" : "▲"} {item.value}
            </span>
          )}
        </div>
        <p style={detailStyle}>{item.detail}</p>
      </div>
    );
  }

  if (item.type === "document") {
    const iconColor = item.severity === "warning" ? "#d97706" : item.severity === "danger" ? "#dc2626" : "#64748b";
    return (
      <div style={rowStyle}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
          <span style={{ color: iconColor, fontSize: "0.875rem", lineHeight: "1.5rem", flexShrink: 0 }}>
            {item.severity === "warning" || item.severity === "danger" ? "⚠" : "✓"}
          </span>
          <div>
            <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "#1e293b" }}>{item.label}</span>
            <p style={detailStyle}>{item.detail}</p>
          </div>
        </div>
      </div>
    );
  }

  if (item.type === "product") {
    const isPass = item.severity === "success";
    const isFail = item.severity === "danger";
    const iconColor = isPass ? "#059669" : isFail ? "#dc2626" : "#64748b";
    const icon = isPass ? "✓" : isFail ? "✗" : "•";
    return (
      <div style={rowStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <span style={{ color: iconColor, fontWeight: 700, fontSize: "0.875rem" }}>{icon}</span>
            <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "#1e293b" }}>{item.label}</span>
          </div>
          {item.value && <span style={{ ...valueStyle, color: iconColor }}>{item.value}</span>}
        </div>
        <p style={detailStyle}>{item.detail}</p>
      </div>
    );
  }

  // action_item
  const actionColor = item.severity === "warning" ? "#d97706" : "#64748b";
  return (
    <div style={{ ...rowStyle, borderLeft: `3px solid ${actionColor}`, paddingLeft: "0.625rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.375rem" }}>
        <span style={{ color: actionColor, fontSize: "0.8125rem", lineHeight: "1.4rem", flexShrink: 0 }}>□</span>
        <div>
          <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "#1e293b" }}>{item.label}</span>
          <p style={detailStyle}>{item.detail}</p>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ section }: { section: VeritasSummarySection }) {
  const borderColor = SEVERITY_BORDER[section.severity ?? "default"] ?? SEVERITY_BORDER.default;
  const bg = SEVERITY_BG[section.severity ?? "default"] ?? SEVERITY_BG.default;

  const cardStyle: CSSProperties = {
    borderLeft: `4px solid ${borderColor}`,
    borderRadius: "0 0.375rem 0.375rem 0",
    background: bg,
    marginBottom: "0.75rem",
    overflow: "hidden",
  };

  const headerStyle: CSSProperties = {
    padding: "0.5rem 0.75rem",
    borderBottom: `1px solid ${borderColor}`,
    fontWeight: 600,
    fontSize: "0.8125rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: SEVERITY_TEXT[section.severity ?? "default"] ?? SEVERITY_TEXT.default,
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>{section.title}</div>
      {section.items.map((item, i) => (
        <ItemRow key={`${item.type}-${item.label}-${i}`} item={item} />
      ))}
    </div>
  );
}

export interface ScenarioNarrativeSummaryProps {
  sections: VeritasSummarySection[];
  name?: string | null;
  eval?: VeritasSummaryEvalResponse | null;
  className?: string;
}

export function ScenarioNarrativeSummary({
  sections,
  name,
  eval: evalResult,
  className,
}: ScenarioNarrativeSummaryProps) {
  if (!sections || sections.length === 0) return null;

  const violationCount = evalResult?.violations?.length ?? 0;

  return (
    <div className={className}>
      {name && (
        <p style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#0f172a", marginBottom: "0.75rem" }}>
          {name}
        </p>
      )}
      {sections.map((section) => (
        <SectionCard key={section.id} section={section} />
      ))}
      {evalResult && !evalResult.clean && violationCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.625rem", background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: "0.25rem", fontSize: "0.75rem", color: "#92400e" }}>
          <span>⚠</span>
          <span>
            {violationCount} grounding {violationCount === 1 ? "issue" : "issues"} detected
            {" "}(score: {(evalResult.confidence_score * 100).toFixed(0)}%)
          </span>
        </div>
      )}
    </div>
  );
}
