import { render, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { CaseDocumentPicker } from "./CaseDocumentPicker.js";
import type { CaseDocumentRow } from "./useCaseDocuments.js";

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function RQ({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const rows: CaseDocumentRow[] = [
  {
    id: "d1",
    docType: "w2",
    taxYear: 2023,
    displayName: "2023 W-2",
    fileId: "f1",
    filename: "alice_w2.pdf",
    firstPage: 1,
    pageCount: 1,
    processedAt: null,
    raw: {} as never,
  },
  {
    id: "d2",
    docType: "form_1040",
    taxYear: 2022,
    displayName: "2022 Form 1040",
    fileId: "f2",
    filename: "alice_1040.pdf",
    firstPage: 1,
    pageCount: 3,
    processedAt: null,
    raw: {} as never,
  },
];

describe("CaseDocumentPicker", () => {
  it("renders rows and supports selecting one", () => {
    const onChange = vi.fn();
    const { getAllByRole, getByLabelText } = render(
      <RQ>
        <CaseDocumentPicker
          caseId={null}
          rows={rows}
          selectedIds={[]}
          onSelectedIdsChange={onChange}
        />
      </RQ>,
    );
    expect(getAllByRole("row").length).toBe(3);
    fireEvent.click(getByLabelText("Toggle 2023 W-2"));
    expect(onChange).toHaveBeenCalledWith(["d1"]);
  });

  it("filters by tax year via the year dropdown", () => {
    const { getByDisplayValue, getAllByRole } = render(
      <RQ>
        <CaseDocumentPicker
          caseId={null}
          rows={rows}
          selectedIds={[]}
          onSelectedIdsChange={() => undefined}
        />
      </RQ>,
    );
    fireEvent.change(getByDisplayValue("All years"), { target: { value: "2023" } });
    expect(getAllByRole("row").length).toBe(2);
  });

  it("select-all checkbox toggles every visible row", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <RQ>
        <CaseDocumentPicker
          caseId={null}
          rows={rows}
          selectedIds={[]}
          onSelectedIdsChange={onChange}
        />
      </RQ>,
    );
    fireEvent.click(getByLabelText("Select all visible documents"));
    expect(onChange).toHaveBeenCalledWith(["d1", "d2"]);
  });
});
