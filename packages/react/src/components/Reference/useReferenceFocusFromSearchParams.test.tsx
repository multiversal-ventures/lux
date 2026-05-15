import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import {
  ReferenceFocusProvider,
  useReferenceFocus,
} from "./ReferenceFocusProvider";
import {
  payloadFromSearchParams,
  useReferenceFocusFromSearchParams,
} from "./useReferenceFocusFromSearchParams";

function ParamsHarness({
  initial,
  onApplied,
  children,
}: {
  initial: URLSearchParams;
  onApplied?: (fact: string) => void;
  children: ReactNode;
}) {
  const [params, setParams] = useState(initial);
  // Expose a way to mutate params for the assertion phase.
  (ParamsHarness as unknown as { __set?: (p: URLSearchParams) => void }).__set =
    setParams;
  return (
    <ReferenceFocusProvider>
      <ParamReader params={params} onApplied={onApplied} />
      {children}
    </ReferenceFocusProvider>
  );
}

function ParamReader({
  params,
  onApplied,
}: {
  params: URLSearchParams;
  onApplied?: (fact: string) => void;
}) {
  useReferenceFocusFromSearchParams(params, { onApplied });
  return null;
}

function FocusCapture({
  capture,
}: {
  capture: { current?: ReturnType<typeof useReferenceFocus> };
}) {
  capture.current = useReferenceFocus();
  return null;
}

describe("payloadFromSearchParams", () => {
  it("returns null when no file is present", () => {
    const sp = new URLSearchParams({ page: "1" });
    expect(payloadFromSearchParams(sp)).toBeNull();
  });

  it("parses file + page + fact", () => {
    const sp = new URLSearchParams({
      file: "abc",
      page: "3",
      fact: "1040.total_wages_amount",
    });
    const out = payloadFromSearchParams(sp);
    expect(out).not.toBeNull();
    expect(out!.canonicalKey).toBe("1040.total_wages_amount");
    expect(out!.payload.file_id).toBe("abc");
    expect(out!.payload.page).toBe(3);
  });

  it("defaults page to 1 when missing", () => {
    const sp = new URLSearchParams({ file: "abc" });
    const out = payloadFromSearchParams(sp);
    expect(out!.payload.page).toBe(1);
  });

  it("parses a JSON-encoded bbox and surfaces it as a single source", () => {
    const bbox = { x: 0.1, y: 0.2, width: 0.3, height: 0.04 };
    const sp = new URLSearchParams({
      file: "abc",
      page: "2",
      bbox: JSON.stringify(bbox),
    });
    const out = payloadFromSearchParams(sp);
    expect(out!.payload.bbox).toEqual(bbox);
    expect(out!.payload.sources).toHaveLength(1);
    expect(out!.payload.sources![0]!.page_number).toBe(2);
  });

  it("ignores malformed bbox json silently", () => {
    const sp = new URLSearchParams({
      file: "abc",
      page: "2",
      bbox: "not-json",
    });
    const out = payloadFromSearchParams(sp);
    expect(out!.payload.bbox).toBeNull();
  });
});

describe("useReferenceFocusFromSearchParams", () => {
  it("does nothing when no file param is present", () => {
    const capture: { current?: ReturnType<typeof useReferenceFocus> } = {};
    render(
      <ParamsHarness initial={new URLSearchParams({ page: "2" })}>
        <FocusCapture capture={capture} />
      </ParamsHarness>,
    );
    expect(capture.current?.focus).toBeNull();
  });

  it("publishes focus when params include a file", () => {
    const capture: { current?: ReturnType<typeof useReferenceFocus> } = {};
    const onApplied = vi.fn();
    render(
      <ParamsHarness
        initial={
          new URLSearchParams({
            file: "file-1",
            page: "4",
            fact: "1040.taxable_interest_amount",
          })
        }
        onApplied={onApplied}
      >
        <FocusCapture capture={capture} />
      </ParamsHarness>,
    );
    expect(capture.current?.focus?.canonicalKey).toBe("1040.taxable_interest_amount");
    expect(capture.current?.focus?.payload.file_id).toBe("file-1");
    expect(capture.current?.focus?.payload.page).toBe(4);
    expect(onApplied).toHaveBeenCalledWith("1040.taxable_interest_amount");
  });

  it("re-publishes focus when params change", () => {
    const capture: { current?: ReturnType<typeof useReferenceFocus> } = {};
    render(
      <ParamsHarness
        initial={new URLSearchParams({ file: "file-1", page: "1", fact: "k1" })}
      >
        <FocusCapture capture={capture} />
      </ParamsHarness>,
    );
    const before = capture.current?.focus?.nonce ?? 0;
    expect(capture.current?.focus?.payload.file_id).toBe("file-1");

    act(() => {
      (ParamsHarness as unknown as { __set: (p: URLSearchParams) => void }).__set(
        new URLSearchParams({ file: "file-2", page: "7", fact: "k2" }),
      );
    });

    expect(capture.current?.focus?.payload.file_id).toBe("file-2");
    expect(capture.current?.focus?.payload.page).toBe(7);
    expect(capture.current?.focus?.canonicalKey).toBe("k2");
    expect((capture.current?.focus?.nonce ?? 0) > before).toBe(true);
  });
});
