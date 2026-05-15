import { describe, it, expect, beforeEach } from "vitest";
import {
  createCaseWorkflowStore,
  type CaseWorkflowStore,
} from "./caseWorkflowStore.js";

describe("caseWorkflowStore", () => {
  let store: CaseWorkflowStore;

  beforeEach(() => {
    store = createCaseWorkflowStore();
  });

  it("starts in the idle phase with empty session state", () => {
    const s = store.getState();
    expect(s.uploadPhase).toBe("idle");
    expect(s.uploadedFileNames).toEqual([]);
    expect(s.previousDocIds).toEqual([]);
    expect(s.lastError).toBeNull();
  });

  it("beginUpload → markExtracting → markReviewing → confirmReview lifecycle", () => {
    store.getState().beginUpload({
      fileNames: ["w2.pdf", "1040.pdf"],
      currentDocIds: ["d1", "d2"],
    });
    expect(store.getState().uploadPhase).toBe("uploading");
    expect(store.getState().uploadedFileNames).toEqual(["w2.pdf", "1040.pdf"]);
    expect(store.getState().previousDocIds).toEqual(["d1", "d2"]);

    store.getState().markExtracting();
    expect(store.getState().uploadPhase).toBe("extracting");

    store.getState().markReviewing();
    expect(store.getState().uploadPhase).toBe("reviewing");

    store.getState().confirmReview();
    expect(store.getState().uploadPhase).toBe("idle");
    expect(store.getState().uploadedFileNames).toEqual([]);
    expect(store.getState().previousDocIds).toEqual([]);
  });

  it("markReviewing transitions directly from uploading (when extraction is fast)", () => {
    store.getState().beginUpload({ fileNames: ["x.pdf"], currentDocIds: [] });
    store.getState().markReviewing();
    expect(store.getState().uploadPhase).toBe("reviewing");
  });

  it("markExtracting is a no-op when already in reviewing", () => {
    store.getState().beginUpload({ fileNames: ["x.pdf"], currentDocIds: [] });
    store.getState().markReviewing();
    store.getState().markExtracting();
    expect(store.getState().uploadPhase).toBe("reviewing");
  });

  it("dismissReview returns to idle without preserving filenames", () => {
    store.getState().beginUpload({ fileNames: ["y.pdf"], currentDocIds: ["d0"] });
    store.getState().markReviewing();
    store.getState().dismissReview();
    expect(store.getState().uploadPhase).toBe("idle");
    expect(store.getState().uploadedFileNames).toEqual([]);
  });

  it("setError populates lastError without changing phase", () => {
    store.getState().beginUpload({ fileNames: ["z.pdf"], currentDocIds: [] });
    store.getState().setError("network down");
    expect(store.getState().lastError).toBe("network down");
    expect(store.getState().uploadPhase).toBe("uploading");
  });
});
