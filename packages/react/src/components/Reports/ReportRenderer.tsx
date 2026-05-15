import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ReportSheet } from "./ReportSheet.js";
import { ReportSheetTabs } from "./ReportSheetTabs.js";
import { useReportWorkbook } from "./useReportWorkbook.js";

const DEFAULT_SHEET_TABLE_CLASS =
	'[&_table]:w-full [&_table]:border-collapse [&_table]:tabular-nums [&_table]:text-[#1e1e1e] [&_table]:font-[Calibri,"Segoe_UI",sans-serif] [&_td]:px-[6px] [&_td]:py-[3px] [&_td]:whitespace-nowrap [&_td]:border [&_td]:border-solid [&_td]:border-[#d4d4d4] [&_td[data-type="n"]]:text-right [&_tr:hover_td]:bg-[#e8f0fe]/40';

export interface ReportRendererProps {
	caseId: string;
	reportName: string;
	scenarioId?: string;
	agencies?: string[];
	tenantSlug?: string;
	/** Initial sheet when omitted uses first sheet in workbook. */
	defaultSheet?: string;
	className?: string;
	sheetClassName?: string;
	tabsClassName?: string;
	tabClassName?: string;
	activeTabClassName?: string;
	loadingFallback?: ReactNode;
	errorFallback?: (err: Error) => ReactNode;
	emptyFallback?: ReactNode;
	children?: ReactNode;
	enabled?: boolean;
}

export function ReportRenderer({
	caseId,
	reportName,
	scenarioId,
	agencies,
	tenantSlug,
	defaultSheet,
	className,
	sheetClassName,
	tabsClassName,
	tabClassName,
	activeTabClassName,
	loadingFallback,
	errorFallback,
	emptyFallback,
	children,
	enabled,
}: ReportRendererProps) {
	const { workbook, isLoading, error } = useReportWorkbook({
		caseId,
		reportName,
		scenarioId,
		agencies,
		tenantSlug,
		enabled,
	});

	const names = workbook?.SheetNames ?? [];
	const initial = useMemo(() => {
		if (!workbook || names.length === 0) return "";
		if (defaultSheet && workbook.Sheets[defaultSheet]) return defaultSheet;
		return names[0] ?? "";
	}, [workbook, defaultSheet, names]);

	const [activeSheet, setActiveSheet] = useState("");

	useEffect(() => {
		if (initial) setActiveSheet(initial);
	}, [initial]);

	const worksheet = workbook && activeSheet ? workbook.Sheets[activeSheet] : undefined;

	const mergedSheetClass = [DEFAULT_SHEET_TABLE_CLASS, sheetClassName].filter(Boolean).join(" ");

	if (isLoading) {
		return <>{loadingFallback ?? <div style={{ padding: "1rem", color: "#64748b" }}>Loading report…</div>}</>;
	}

	if (error) {
		return <>{errorFallback ? errorFallback(error) : <div style={{ padding: "1rem", color: "#b91c1c" }}>{error.message}</div>}</>;
	}

	if (!workbook || !worksheet) {
		return <>{emptyFallback ?? null}</>;
	}

	return (
		<div className={className}>
			<div style={{ overflow: "auto", maxHeight: "min(70vh, 560px)" }}>
				<ReportSheet worksheet={worksheet} className={mergedSheetClass} />
			</div>
			<ReportSheetTabs
				workbook={workbook}
				activeSheet={activeSheet}
				onSheetChange={setActiveSheet}
				className={tabsClassName}
				tabClassName={tabClassName}
				activeTabClassName={activeTabClassName}
			/>
			{children}
		</div>
	);
}
