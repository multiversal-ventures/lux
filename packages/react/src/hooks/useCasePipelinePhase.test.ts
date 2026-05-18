import { describe, it, expect } from "vitest";
import type { CaseEvent } from "@multiversal-ventures/lux-core";
import { derivePipelinePhase } from "./useCasePipelinePhase.js";

function ev(event_type: string, event_id = 1): CaseEvent {
  return { event_id, event_type, event_data: null, created_at: null };
}

describe("derivePipelinePhase", () => {
  it("returns null for empty events", () => {
    expect(derivePipelinePhase([])).toBeNull();
  });

  it("maps intake domain to classifying", () => {
    expect(derivePipelinePhase([ev("intake.started")])).toEqual({
      code: "classifying",
      priority: 2,
    });
  });

  it("maps classify domain to classifying", () => {
    expect(derivePipelinePhase([ev("classify.done")])).toEqual({
      code: "classifying",
      priority: 2,
    });
  });

  it("maps extraction domain to extracting", () => {
    expect(derivePipelinePhase([ev("extraction.page.extracted")])).toEqual({
      code: "extracting",
      priority: 3,
    });
  });

  it("maps identify domain to validating", () => {
    expect(derivePipelinePhase([ev("identify.completed")])).toEqual({
      code: "validating",
      priority: 4,
    });
  });

  it("maps banking domain to unification", () => {
    expect(derivePipelinePhase([ev("banking.started")])).toEqual({
      code: "unification",
      priority: 6,
    });
  });

  it("maps qualify domain to income_verification", () => {
    expect(derivePipelinePhase([ev("qualify.spec.evaluated")])).toEqual({
      code: "income_verification",
      priority: 7,
    });
  });

  it("maps case.system.completed to completed", () => {
    expect(derivePipelinePhase([ev("case.system.completed")])).toEqual({
      code: "completed",
      priority: 8,
    });
  });

  it("does NOT advance to completed for case.products.suggested", () => {
    // This is the regression: case.products.suggested fires during stitch
    // and must NOT be treated as a terminal completed signal.
    const result = derivePipelinePhase([ev("case.products.suggested")]);
    expect(result).toBeNull();
  });

  it("does NOT advance to completed for arbitrary case.* events", () => {
    const result = derivePipelinePhase([
      ev("intake.started", 1),
      ev("case.products.suggested", 2),
    ]);
    // High-water should be classifying (from intake), not completed
    expect(result?.code).toBe("classifying");
    expect(result?.priority).toBe(2);
  });

  it("returns the highest-priority phase seen across all events", () => {
    const events: CaseEvent[] = [
      ev("intake.started", 1),
      ev("classify.done", 2),
      ev("extraction.page.extracted", 3),
    ];
    expect(derivePipelinePhase(events)).toEqual({
      code: "extracting",
      priority: 3,
    });
  });

  it("phase only advances, never regresses (high-water mark)", () => {
    // Even if events arrive out of logical order, highest priority wins
    const events: CaseEvent[] = [
      ev("qualify.spec.evaluated", 1),
      ev("intake.started", 2),
    ];
    expect(derivePipelinePhase(events)).toEqual({
      code: "income_verification",
      priority: 7,
    });
  });

  it("advances to completed only on case.system.completed, not other case events", () => {
    const events: CaseEvent[] = [
      ev("qualify.spec.evaluated", 1),
      ev("case.products.suggested", 2),
      ev("case.system.completed", 3),
    ];
    expect(derivePipelinePhase(events)).toEqual({
      code: "completed",
      priority: 8,
    });
  });

  it("ignores unknown domains", () => {
    expect(derivePipelinePhase([ev("stream.heartbeat")])).toBeNull();
  });
});
