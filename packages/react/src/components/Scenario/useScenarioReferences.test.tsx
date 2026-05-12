import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { CaseScenarioProvider, ScenarioProvider } from "./ScenarioProvider";
import {
  payloadFromRow,
  useScenarioReferences,
  type UseScenarioReferencesResult,
} from "./useScenarioReferences";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function RQ({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  queryClient.clear();
});

const scenario = {
  scenario_id: "s1",
  case_id: "c1",
  approach: "qm",
  pool_version: 1,
  status: "completed",
  created_at: null,
  rendering_hints: {
    is_non_qm: false,
    show_product_tabs: true,
    effective_product_ids: ["fannie_mae"],
    effective_borrower_ids: [],
    effective_document_ids: [],
    best_qualifying_income: 0,
    approach_type: "qm_standard",
    product_specs: [
      {
        product_id: "fannie_mae",
        display_name: "Fannie Mae",
        agency: "fnma",
        spec_names: ["fnma_w2_wages_income"],
        total_monthly: 0,
      },
    ],
    advice: [],
  },
} as const;

const auditWithProvenance = [
  {
    spec_name: "fnma_w2_wages_income",
    outcome: "eligible",
    monthly_amount: 7791.67,
    steps: [
      {
        step_number: 1,
        derivation_name: "total_wages_y1",
        formula: "wages_y1",
        formula_display: "$95,000",
        result: 95000,
        result_type: "currency",
        is_final: false,
        function_calls: [],
        input_values: [
          {
            name: "wages_y1",
            value: 95000,
            source_line: null,
            document_type: null,
            provenance: [
              {
                extraction_id: "ext-1",
                doc_id: "doc-1040-2025",
                doc_type: "IRS1040",
                canonical_key: "1040.total_wages_amount",
                value: 95000,
                raw_value: "95000",
                sources: [
                  { file_id: "file-1040-2025", page_number: 1, bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 } },
                ],
              },
            ],
          },
        ],
      },
      {
        step_number: 2,
        derivation_name: "yoy_change",
        formula: "wages_y2 - wages_y1",
        formula_display: "",
        result: -3000,
        result_type: "currency",
        is_final: false,
        function_calls: [],
        // Same canonical_key + doc_id should dedupe to a single row,
        // accumulating the consuming variable + spec.
        input_values: [
          {
            name: "wages_y2",
            value: 92000,
            source_line: null,
            document_type: null,
            provenance: [
              {
                extraction_id: "ext-2",
                doc_id: "doc-1040-2024",
                doc_type: "IRS1040",
                canonical_key: "1040.total_wages_amount",
                value: 92000,
                raw_value: "92000",
                sources: [{ file_id: "file-1040-2024", page_number: 1, bbox: { x: 0, y: 0, width: 0.1, height: 0.1 } }],
              },
            ],
          },
        ],
      },
    ],
    proof_trace: [],
  },
  {
    // Re-use of (canonical_key, doc_id) by a different spec → dedup + add to .specs.
    spec_name: "fnma_total_income",
    outcome: "eligible",
    monthly_amount: 0,
    steps: [
      {
        step_number: 1,
        derivation_name: "employment_wages_monthly",
        formula: "wages_y1 / 12",
        formula_display: "",
        result: 7916.67,
        result_type: "currency",
        is_final: false,
        function_calls: [],
        input_values: [
          {
            name: "wages_y1",
            value: 95000,
            source_line: null,
            document_type: null,
            provenance: [
              {
                extraction_id: "ext-1",
                doc_id: "doc-1040-2025",
                doc_type: "IRS1040",
                canonical_key: "1040.total_wages_amount",
                value: 95000,
                raw_value: "95000",
                sources: [{ file_id: "file-1040-2025", page_number: 1, bbox: null }],
              },
            ],
          },
        ],
      },
    ],
    proof_trace: [],
  },
];

function captureHook(audit: any[], initialProductId = "fannie_mae") {
  const captured: { value?: UseScenarioReferencesResult } = {};
  function Capture() {
    captured.value = useScenarioReferences();
    return null;
  }
  render(
    <CaseScenarioProvider caseId="c1">
      <ScenarioProvider
        scenarioId="s1"
        scenario={scenario as any}
        audit={audit as any}
        initialProductId={initialProductId}
      >
        <Capture />
      </ScenarioProvider>
    </CaseScenarioProvider>,
    { wrapper: RQ },
  );
  return captured.value!;
}

describe("useScenarioReferences", () => {
  it("dedupes by (canonical_key, doc_id) across specs and accumulates variables + specs", () => {
    const r = captureHook(auditWithProvenance);
    expect(r.agency).toBe("fnma");
    expect(r.rows).toHaveLength(2);
    const y1 = r.rows.find((row) => row.docId === "doc-1040-2025");
    expect(y1).toBeDefined();
    expect(y1!.canonicalKey).toBe("1040.total_wages_amount");
    expect(y1!.variables).toEqual(["wages_y1"]);
    expect(y1!.specs).toEqual(["fnma_w2_wages_income", "fnma_total_income"]);
    expect(y1!.sources[0]?.file_id).toBe("file-1040-2025");
    expect(r.totalInputValues).toBe(3);
    expect(r.totalProvenanceEntries).toBe(3);
    expect(r.derivedFromDocs).toBe(false);
    expect(r.emptyMessage).toBeNull();
  });

  it("falls back to refinement documents when no audit provenance exists", () => {
    const captured: { value?: UseScenarioReferencesResult } = {};
    function Capture() {
      captured.value = useScenarioReferences();
      return null;
    }
    render(
      <CaseScenarioProvider caseId="c1">
        <ScenarioProvider
          scenarioId="s1"
          scenario={scenario as any}
          audit={[]}
          initialProductId="fannie_mae"
          refinements={
            [
              {
                refinement_id: "ref-1",
                scenario_id: "s1",
                refinement_num: 0,
                identities: [],
                documents: [
                  { id: "doc-1", doc_type: "IRSW2", display_type: "W-2", filename: "W2_2024.pdf" },
                ],
                product_ids: [],
                specs_run: [],
                note: null,
                errors: [],
              },
            ] as any
          }
        >
          <Capture />
        </ScenarioProvider>
      </CaseScenarioProvider>,
      { wrapper: RQ },
    );
    const r = captured.value!;
    expect(r.derivedFromDocs).toBe(true);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.docType).toBe("IRSW2");
    expect(r.rows[0]!.derived).toBe(true);
  });

  it("emits the right empty-state message when audit has rows but no provenance", () => {
    const auditNoProv = [
      {
        spec_name: "fnma_w2_wages_income",
        outcome: "none",
        monthly_amount: null,
        steps: [
          {
            step_number: 1,
            derivation_name: "total_wages_y1",
            formula: "wages_y1",
            formula_display: "",
            result: 0,
            result_type: "currency",
            is_final: false,
            function_calls: [],
            input_values: [
              {
                name: "wages_y1",
                value: 0,
                source_line: null,
                document_type: null,
                provenance: [],
              },
            ],
          },
        ],
        proof_trace: [],
      },
    ];
    const r = captureHook(auditNoProv);
    expect(r.rows).toHaveLength(0);
    expect(r.emptyMessage).toMatch(/no extraction provenance is attached/i);
  });

  it("emits empty-state when no audit rows match the agency", () => {
    const auditWrongAgency = [
      {
        spec_name: "fhlmc_w2_wages_income",
        outcome: "none",
        monthly_amount: null,
        steps: [],
        proof_trace: [],
      },
    ];
    const r = captureHook(auditWrongAgency);
    expect(r.rows).toHaveLength(0);
    expect(r.emptyMessage).toMatch(/no audit rows for fnma/i);
  });
});

describe("payloadFromRow", () => {
  it("uses the first source by default", () => {
    const r = captureHook(auditWithProvenance);
    const row = r.rows[0]!;
    const payload = payloadFromRow(row);
    expect(payload.doc_id).toBe(row.docId);
    expect(payload.file_id).toBe(row.sources[0]!.file_id);
    expect(payload.page).toBe(row.sources[0]!.page_number);
    expect(payload.variable).toBe(row.variables[0]);
    expect(payload.sources).toBe(row.sources);
  });

  it("anchors to a specific source when provided", () => {
    const r = captureHook(auditWithProvenance);
    const row = r.rows[0]!;
    const extra = {
      file_id: "alt-file",
      page_number: 7,
      bbox: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 },
    };
    const payload = payloadFromRow(row, extra);
    expect(payload.file_id).toBe("alt-file");
    expect(payload.page).toBe(7);
    expect(payload.bbox).toEqual(extra.bbox);
  });
});
