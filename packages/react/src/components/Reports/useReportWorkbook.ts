import { useQuery, useQueryClient } from "@tanstack/react-query";
import { read, type WorkBook } from "xlsx";
import { getDefaultClient, type components } from "@multiversal-ventures/lux-core";

export type ReportGenerateResponse = components["schemas"]["ReportGenerateResponse"];

export function reportWorkbookQueryKey(
	caseId: string,
	reportName: string,
	scenarioId?: string,
	agenciesKey?: string,
	tenantSlug?: string,
): readonly string[] {
	return [
		"case",
		caseId,
		"report-workbook",
		reportName,
		scenarioId ?? "",
		agenciesKey ?? "",
		tenantSlug ?? "",
	] as const;
}

async function fetchReportWorkbook(params: {
	caseId: string;
	reportName: string;
	scenarioId?: string;
	agencies?: string[];
	tenantSlug?: string;
}): Promise<{ workbook: WorkBook; report: ReportGenerateResponse }> {
	const client = getDefaultClient();
	const body: components["schemas"]["ReportGenerateRequest"] = {};
	if (params.scenarioId) body.scenario_id = params.scenarioId;
	if (params.tenantSlug) body.tenant_slug = params.tenantSlug;
	if (params.agencies?.length) body.agencies = params.agencies;

	const gen = await client.generateReport(params.caseId, params.reportName, body);
	let reportId = gen.report_id;

	if (!reportId && params.scenarioId) {
		const list = await client.listReports(params.caseId, { scenarioId: params.scenarioId });
		const item = list.find((r) => r.report_name === params.reportName);
		reportId = item?.last_report_id ?? null;
	}

	if (!reportId) {
		throw new Error(
			"No report_id returned; pass scenario_id after qualify so the report can be downloaded.",
		);
	}

	const { blob } = await client.downloadReport(params.caseId, params.reportName, reportId);
	const buf = await blob.arrayBuffer();
	const workbook = read(buf, { type: "array", cellStyles: true });
	const report: ReportGenerateResponse = { ...gen, report_id: reportId };
	return { workbook, report };
}

export interface UseReportWorkbookOptions {
	caseId: string;
	reportName: string;
	scenarioId?: string;
	agencies?: string[];
	tenantSlug?: string;
	enabled?: boolean;
}

export interface UseReportWorkbookResult {
	workbook: WorkBook | undefined;
	report: ReportGenerateResponse | undefined;
	isLoading: boolean;
	error: Error | null;
	regenerate: () => void;
}

export function useReportWorkbook(opts: UseReportWorkbookOptions): UseReportWorkbookResult {
	const queryClient = useQueryClient();
	const agenciesKey = (opts.agencies ?? []).join(",");
	const q = useQuery({
		queryKey: reportWorkbookQueryKey(opts.caseId, opts.reportName, opts.scenarioId, agenciesKey, opts.tenantSlug),
		queryFn: () =>
			fetchReportWorkbook({
				caseId: opts.caseId,
				reportName: opts.reportName,
				scenarioId: opts.scenarioId,
				agencies: opts.agencies,
				tenantSlug: opts.tenantSlug,
			}),
		enabled: opts.enabled !== false && !!opts.caseId && !!opts.reportName,
	});

	const regenerate = () => {
		queryClient.invalidateQueries({
			queryKey: ["case", opts.caseId, "report-workbook"],
		});
	};

	return {
		workbook: q.data?.workbook,
		report: q.data?.report,
		isLoading: q.isLoading,
		error: q.error instanceof Error ? q.error : q.error ? new Error(String(q.error)) : null,
		regenerate,
	};
}
