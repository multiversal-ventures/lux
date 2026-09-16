import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CaseDocumentViewer } from "./CaseDocumentViewer.js";

vi.mock("./CasePageImage.js", () => ({
	CasePageImage: () => <img alt="page" />,
}));

vi.mock("./useCaseExtractions.js", () => ({
	useCaseExtractions: () => ({
		data: [
			{
				extraction_id: "e-table",
				doc_id: "d-1",
				doc_type: "IRS1040ScheduleB",
				field_name: "Line1_InterestPayerList",
				canonical_key: "schedule_b.Line1_InterestPayerList",
				value: "[{...}]",
				confidence: null,
				sources: [
					{
						page_number: 1,
						file_id: "f-1",
						source_type: "pdf_region",
						bbox: { x: 0.1, y: 0.2, width: 0.7, height: 0.02 },
					},
					{
						page_number: 1,
						file_id: "f-1",
						source_type: "pdf_region",
						bbox: { x: 0.1, y: 0.24, width: 0.7, height: 0.02 },
					},
				],
			},
		],
	}),
}));

const docs = [
	{
		doc_id: "d-1",
		file_id: "f-1",
		doc_type: "IRS1040ScheduleB",
		page_numbers: [1],
	},
];

describe("CaseDocumentViewer table sources", () => {
	it("draws every row box and toggles their shared extraction together", () => {
		const onSelectionChange = vi.fn();
		const { getAllByRole, getByText } = render(
			<CaseDocumentViewer
				caseId="c"
				docs={docs as never}
				onSelectionChange={onSelectionChange}
				classNames={{ bboxActive: "active" }}
			/>,
		);
		const boxes = getAllByRole("button").filter((element) =>
			(element.getAttribute("aria-label") ?? "").includes("Line1_InterestPayerList"),
		);

		expect(boxes).toHaveLength(2);
		expect(getByText("Extractions (1)")).toBeTruthy();
		expect(boxes.every((box) => !box.classList.contains("active"))).toBe(true);

		fireEvent.click(boxes[0]);

		expect(onSelectionChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ extraction_id: "e-table" }),
		);
		expect(boxes.every((box) => box.classList.contains("active"))).toBe(true);

		fireEvent.click(boxes[1]);

		expect(onSelectionChange).toHaveBeenLastCalledWith(null);
		expect(boxes.every((box) => !box.classList.contains("active"))).toBe(true);
	});
});
