import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { utils } from "@multiversal-ventures/xlsx";
import { ReportSheet } from "./ReportSheet.js";

describe("ReportSheet", () => {
	it("renders sheet HTML from a minimal worksheet", () => {
		const ws: Record<string, unknown> = {};
		ws["!ref"] = "A1:B2";
		ws[utils.encode_cell({ r: 0, c: 0 })] = { v: "Hello", t: "s" };
		ws[utils.encode_cell({ r: 1, c: 1 })] = { v: 42, t: "n" };

		const { container } = render(<ReportSheet worksheet={ws as never} />);
		const html = container.innerHTML;
		expect(html).toContain("<table>");
		expect(html).toContain("Hello");
		expect(html).toContain("42");
	});

	it("renders a literal '&' once, never the double-escaped '&amp;'", () => {
		// SheetJS sets cell.h to the pre-escaped 'Meals &amp; Entertainment';
		// the renderer must use .w/.v so the visible text is a single '&'.
		const ws: Record<string, unknown> = {};
		ws["!ref"] = "A1:A1";
		ws[utils.encode_cell({ r: 0, c: 0 })] = {
			v: "Meals & Entertainment",
			w: "Meals & Entertainment",
			h: "Meals &amp; Entertainment",
			t: "s",
		};

		const { container } = render(<ReportSheet worksheet={ws as never} />);
		// textContent is the decoded, user-visible text.
		expect(container.textContent).toContain("Meals & Entertainment");
		expect(container.textContent).not.toContain("&amp;");
	});
});
