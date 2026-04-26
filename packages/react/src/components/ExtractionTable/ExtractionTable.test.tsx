import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ExtractionTable } from "./ExtractionTable";

describe("ExtractionTable", () => {
	it("renders field, value, confidence, and page chip", () => {
		const { getByText } = render(
			<ExtractionTable extractions={[{
				extraction_id: "e-1", doc_id: "d-1", doc_type: "BankStatement",
				field_name: "gross_deposits", canonical_key: null,
				value: "12450.00", confidence: 0.95,
				sources: [{ page_number: 2, bbox: null, ocr_text_snippet: null, file_id: "f-1", source_type: "pdf" }],
			}]} />,
		);
		expect(getByText("gross_deposits")).toBeInTheDocument();
		expect(getByText("12450.00")).toBeInTheDocument();
		expect(getByText("95%")).toBeInTheDocument();
		expect(getByText("P2")).toBeInTheDocument();
	});
});
