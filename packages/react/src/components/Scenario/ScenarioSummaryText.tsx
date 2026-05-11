import { useScenarioSummary, type FormatScenarioSummaryOptions, type HasSummaryResult } from "./useScenarioSummary.js";

export interface ScenarioSummaryTextProps extends FormatScenarioSummaryOptions {
  /**
   * Any entity carrying `summary_result` (scenario, refinement, future
   * domains). The component never inspects `domain` — host code decides
   * which entity's summary to render.
   */
  source: HasSummaryResult | null | undefined;
  /** Visible string when no summary value exists. Defaults to `"—"`. */
  emptyText?: string;
  className?: string;
  /** Render tag; defaults to `span` so it inlines with surrounding text. */
  as?: "span" | "p" | "div";
}

/**
 * Display the formatted headline summary value from any entity that carries
 * `summary_result`. Styling is host-supplied via `className` so this stays a
 * pure presentation atom.
 */
export function ScenarioSummaryText({
  source,
  emptyText = "—",
  className,
  as = "span",
  ...formatOptions
}: ScenarioSummaryTextProps) {
  const { formatted } = useScenarioSummary(source, {
    ...formatOptions,
    placeholder: emptyText,
  });
  const Tag = as;
  return <Tag className={className}>{formatted ?? emptyText}</Tag>;
}
