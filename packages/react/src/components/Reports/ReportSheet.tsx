import { useMemo, type CSSProperties } from "react";
import type { WorkSheet } from "@multiversal-ventures/xlsx";
import { sheetToHtmlWithStyles } from "../../lib/excelSheet.js";

/**
 * Renders one worksheet as an HTML table (cell styles preserved).
 * Uses `dangerouslySetInnerHTML` — only use with workbooks from trusted Veritas APIs.
 */
export interface ReportSheetProps {
	worksheet: WorkSheet;
	className?: string;
	/** Optional wrapper style (e.g. for measurement / off-screen layout). */
	style?: CSSProperties;
}

export function ReportSheet({ worksheet, className, style }: ReportSheetProps) {
	const html = useMemo(
		() => sheetToHtmlWithStyles(worksheet as unknown as Record<string, unknown>),
		[worksheet],
	);
	return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}
