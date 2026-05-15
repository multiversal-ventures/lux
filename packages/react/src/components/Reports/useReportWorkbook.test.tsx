import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { utils, write } from "xlsx";

const generateReport = vi.fn();
const downloadReport = vi.fn();
const listReports = vi.fn();

vi.mock("@fenero/lux-core", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@fenero/lux-core")>();
	return {
		...actual,
		getDefaultClient: () => ({
			generateReport,
			downloadReport,
			listReports,
		}),
	};
});

import { useReportWorkbook } from "./useReportWorkbook.js";

function Probe() {
	const { workbook, error, isLoading } = useReportWorkbook({
		caseId: "c1",
		reportName: "income_qm",
		scenarioId: "s1",
		agencies: ["fnma"],
	});
	if (isLoading) return <div>loading</div>;
	if (error) return <div>{error.message}</div>;
	if (!workbook) return <div>empty</div>;
	return <div data-testid="wb">{workbook.SheetNames.join(",")}</div>;
}

describe("useReportWorkbook", () => {
	let client: QueryClient;

	beforeEach(() => {
		client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		vi.clearAllMocks();
	});

	it("loads workbook via generate + download", async () => {
		generateReport.mockResolvedValue({
			report_id: "rid-1",
			report_name: "income_qm",
			storage_key: "k",
			generated_at: new Date().toISOString(),
			spec_version: "1",
		});

		const ws: Record<string, unknown> = {};
		ws["!ref"] = "A1";
		ws[utils.encode_cell({ r: 0, c: 0 })] = { v: "x", t: "s" };
		const buf = write({ SheetNames: ["S1"], Sheets: { S1: ws } }, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

		downloadReport.mockResolvedValue({
			blob: new Blob([buf], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
			filename: "income_qm_rid-1.xlsx",
		});

		render(
			<QueryClientProvider client={client}>
				<Probe />
			</QueryClientProvider>,
		);

		expect(screen.getByText("loading")).toBeTruthy();
		await waitFor(() => expect(screen.getByTestId("wb")).toBeTruthy());
		expect(screen.getByTestId("wb")).toHaveTextContent("S1");
		expect(generateReport).toHaveBeenCalled();
		expect(downloadReport).toHaveBeenCalledWith("c1", "income_qm", "rid-1");
	});

	it("uses listReports when generate returns no report_id", async () => {
		generateReport.mockResolvedValue({
			report_id: null,
			report_name: "income_qm",
			storage_key: "k",
			generated_at: new Date().toISOString(),
			spec_version: null,
		});
		listReports.mockResolvedValue([
			{
				report_name: "income_qm",
				description: null,
				last_generated_at: null,
				last_report_id: "from-list",
				last_storage_key: null,
			},
		]);

		const ws: Record<string, unknown> = {};
		ws["!ref"] = "A1";
		ws[utils.encode_cell({ r: 0, c: 0 })] = { v: "y", t: "s" };
		const buf = write({ SheetNames: ["A"], Sheets: { A: ws } }, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
		downloadReport.mockResolvedValue({
			blob: new Blob([buf]),
			filename: "f.xlsx",
		});

		render(
			<QueryClientProvider client={client}>
				<Probe />
			</QueryClientProvider>,
		);

		await waitFor(() => expect(screen.getByTestId("wb")).toHaveTextContent("A"));
		expect(listReports).toHaveBeenCalledWith("c1", { scenarioId: "s1" });
		expect(downloadReport).toHaveBeenCalledWith("c1", "income_qm", "from-list");
	});
});
