import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DocumentList } from "./DocumentList";

describe("DocumentList", () => {
	it("renders a doc with doc_type badge and filename", () => {
		const { getByText } = render(
			<DocumentList documents={[{
				doc_id: "d-1", doc_type: "BankStatement", original_filename: "jan.pdf",
				file_id: "f-1", page_numbers: [1, 2], effective_period_start: null,
				effective_period_end: null, tax_year: null,
			}]} />,
		);
		expect(getByText("jan.pdf")).toBeInTheDocument();
		expect(getByText("BankStatement")).toBeInTheDocument();
	});
});
