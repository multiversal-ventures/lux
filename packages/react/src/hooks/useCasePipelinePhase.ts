import { useMemo } from "react";
import type { CaseEvent } from "@multiversal-ventures/lux-core";
import { useCaseEvents } from "../providers/CaseEventsProvider.js";

// Veritas event domain → pipeline phase code.
// The 'case' domain is intentionally absent: case.* events are lifecycle
// signals, not phase transitions. Only case.system.completed is terminal
// and is handled explicitly in derivePipelinePhase below.
const DOMAIN_TO_PHASE: Record<string, string> = {
  intake: "classifying",
  classify: "classifying",
  stitch: "extracting",
  extraction: "extracting",
  identify: "validating",
  banking: "unification",
  qualify: "income_verification",
};

export const PIPELINE_PHASE_PRIORITY: Record<string, number> = {
  loading: 1,
  classifying: 2,
  extracting: 3,
  validating: 4,
  cross_doc: 5,
  unification: 6,
  income_verification: 7,
  completed: 8,
};

export interface PipelinePhaseResult {
  code: string;
  priority: number;
}

/**
 * Pure function: compute the high-water mark pipeline phase from a list of
 * case events. Phase only advances, never regresses. Returns null when no
 * mappable event has been seen yet.
 *
 * Exported for unit testing. Consumers should prefer the `useCasePipelinePhase`
 * hook which reads events from the nearest `<CaseEventsProvider>`.
 */
export function derivePipelinePhase(
  events: CaseEvent[],
): PipelinePhaseResult | null {
  let best: PipelinePhaseResult | null = null;

  for (const event of events) {
    const domain = event.event_type.split(".")[0] ?? "";
    const phase =
      event.event_type === "case.system.completed"
        ? "completed"
        : DOMAIN_TO_PHASE[domain];

    if (!phase) continue;
    const priority = PIPELINE_PHASE_PRIORITY[phase] ?? 0;
    if (!best || priority > best.priority) {
      best = { code: phase, priority };
    }
  }

  return best;
}

/**
 * Returns the high-water mark pipeline phase derived from the case events
 * provided by the nearest `<CaseEventsProvider>`. Phase only advances,
 * never regresses. Returns null until the first mappable event arrives.
 */
export function useCasePipelinePhase(): PipelinePhaseResult | null {
  const { events } = useCaseEvents();
  return useMemo(() => derivePipelinePhase(events), [events]);
}
