import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScenarioRunsStore, type ScenarioRunsStore } from "./scenarioRunsStore.js";

describe("scenarioRunsStore", () => {
  let store: ScenarioRunsStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-13T18:00:00Z"));
    store = createScenarioRunsStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts empty — no scenario is just-started", () => {
    expect(store.getState().justStartedAt).toEqual({});
    expect(store.getState().isJustStarted("s1")).toBe(false);
  });

  it("markJustStarted records a timestamp keyed by scenario id", () => {
    store.getState().markJustStarted("s1");
    expect(store.getState().justStartedAt["s1"]).toBe(Date.now());
    expect(store.getState().isJustStarted("s1")).toBe(true);
    expect(store.getState().isJustStarted("s2")).toBe(false);
  });

  it("clearJustStarted removes the pulse for that scenario only", () => {
    store.getState().markJustStarted("s1");
    store.getState().markJustStarted("s2");
    store.getState().clearJustStarted("s1");
    expect(store.getState().isJustStarted("s1")).toBe(false);
    expect(store.getState().isJustStarted("s2")).toBe(true);
  });

  it("isJustStarted respects the TTL — pulses expire", () => {
    store.getState().markJustStarted("s1");
    expect(store.getState().isJustStarted("s1", 5_000)).toBe(true);
    vi.advanceTimersByTime(6_000);
    expect(store.getState().isJustStarted("s1", 5_000)).toBe(false);
  });

  it("reset wipes every pulse", () => {
    store.getState().markJustStarted("s1");
    store.getState().markJustStarted("s2");
    store.getState().reset();
    expect(store.getState().justStartedAt).toEqual({});
  });

  it("subscribe fires on mark / clear", () => {
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    store.getState().markJustStarted("s1");
    store.getState().clearJustStarted("s1");
    expect(listener).toHaveBeenCalledTimes(2);
    unsub();
  });
});
