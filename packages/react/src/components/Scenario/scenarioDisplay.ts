import type { components } from "@multiversal-ventures/lux-core";

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
 * Refinement row title for sidebars / lists.
 *
 * Naming rules — informed by operator feedback that ``Run #0 — TechCorp
 * Industries Inc. — W2 Wages Income Analysis`` reads as noisy
 * boilerplate when every row in the list shares the ``Run #0`` prefix
 * (every fresh manifest, including auto-bootstrap and operator
 * Save-&-Run flows, lands at ``refinement_num=0`` until the next
 * version of the manifest pipeline lands). We treat the ``Run #N``
 * prefix as a fallback identity only:
 *
 *   1. If the refinement has a real ``name`` (LLM-generated headline
 *      or operator-supplied) → just the name.
 *   2. Else if it carries a ``note`` (e.g. "Refined with 3 extraction
 *      edits") → just the note's first line, capped.
 *   3. Else → ``Run #N`` as a last-resort identifier.
 *
 * This keeps the sidebar scannable: the operator sees what's IN the
 * refinement, not its zero-indexed position.
 */
export function formatRefinementRowTitle(refinement: RefinementResponse): string {
  const sub = formatRefinementSubtitle(refinement);
  if (sub !== "Untitled refinement") return sub;
  const num = refinement.refinement_num;
  return num != null ? `Run #${num}` : "Refinement";
}
