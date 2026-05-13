import type { components } from "@fenero/lux-core";

type ScenarioComparisonResponse = components["schemas"]["ScenarioComparisonResponse"];
type ScenarioDetailResponse = components["schemas"]["ScenarioDetailResponse"];
type RefinementResponse = components["schemas"]["RefinementResponse"];

const APPROACH_SHORT: Record<string, string> = {
  qualified_mortgage: "Qualified Mortgage",
  non_qualified_mortgage: "Non-Qualified Mortgage",
  dscr: "DSCR",
};

/**
 * Primary human-readable title for a scenario row (comparison list) or detail.
 * Prefers persisted `name`, then a friendly approach label.
 */
export function resolveScenarioDisplayName(
  scenario: ScenarioComparisonResponse | ScenarioDetailResponse,
): string {
  const raw = "name" in scenario ? scenario.name : undefined;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (trimmed.length > 0) return trimmed;
  const approach = scenario.approach ?? "";
  return APPROACH_SHORT[approach] ?? (approach ? approach.replace(/_/g, " ") : "Scenario");
}

/**
 * Sidebar / card headline: includes a stable run index (1-based) for the list position.
 */
export function formatScenarioListHeadline(
  scenario: ScenarioComparisonResponse,
  runIndex: number,
): string {
  const base = resolveScenarioDisplayName(scenario);
  return `${base} — Run ${runIndex}`;
}

const NOTE_CAP = 96;

/** Shown after an explicit `Run #n` / `#n` prefix — never repeats the run index. */
export function formatRefinementSubtitle(refinement: RefinementResponse): string {
  const n = refinement.name?.trim();
  if (n) return n;
  const note = refinement.note?.trim();
  if (note) {
    const line = note.split(/\r?\n/)[0]!.trim();
    if (!line) return "Untitled refinement";
    return line.length > NOTE_CAP ? `${line.slice(0, NOTE_CAP - 1)}…` : line;
  }
  return "Untitled refinement";
}

/**
 * Refinement label when shown alone: `name`, else first line of `note`, else `Run #n` / `Refinement`.
 */
export function formatRefinementDisplayName(refinement: RefinementResponse): string {
  const sub = formatRefinementSubtitle(refinement);
  if (sub !== "Untitled refinement") return sub;
  const num = refinement.refinement_num;
  return num != null ? `Run #${num}` : "Refinement";
}

/**
 * Full refinement row title (number + body), e.g. `Run #0 — My label` (body never duplicates the run index).
 */
export function formatRefinementRowTitle(refinement: RefinementResponse): string {
  const num = refinement.refinement_num;
  const prefix = num != null ? `Run #${num}` : "Run";
  return `${prefix} — ${formatRefinementSubtitle(refinement)}`;
}
