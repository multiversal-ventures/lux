/**
 * InlineExcelSheet - Renders Excel sheet content inline (no modal).
 * Uses SheetJS cellStyles for style preservation.
 * Expects a pre-parsed worksheet from parent (no fetching).
 * Scales table width to fit container when it would overflow.
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { utils } from "xlsx";
import type { WorkSheet } from "xlsx";
import { Eye, EyeOff } from "lucide-react";
import { sheetToHtmlWithStyles } from "../../lib/excelSheet";

interface InlineExcelSheetProps {
	worksheet: WorkSheet;
	/** When true, omit the outer border — parent provides the frame. */
	borderless?: boolean;
}

type SheetStats = { rows: number; cols: number } | null;

export function InlineExcelSheet({ worksheet, borderless = false }: InlineExcelSheetProps) {
	const [scale, setScale] = useState(1);
	const [scaleReady, setScaleReady] = useState(false);
	const [displayedSheetHtml, setDisplayedSheetHtml] = useState("");
	const [displayedSheetStats, setDisplayedSheetStats] = useState<SheetStats>(null);
	const [isFadingOut, setIsFadingOut] = useState(false);
	const [showHidden, setShowHidden] = useState(false);
	const pendingSheetRef = useRef<{ html: string; stats: SheetStats } | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const tableWrapperRef = useRef<HTMLDivElement>(null);
	const measureWrapperRef = useRef<HTMLDivElement>(null);

	const sheetHtml = worksheet ? sheetToHtmlWithStyles(worksheet as Record<string, unknown>) : "";
	const sheetStats: SheetStats = useMemo(
		() =>
			worksheet
				? (() => {
						const rows = utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "" });
						const numCols =
							rows.length > 0 ? Math.max(...rows.map((r) => (r as unknown[]).length), 1) : 0;
						return { rows: rows.length, cols: numCols };
					})()
				: null,
		[worksheet],
	);

	const hiddenRowCount = useMemo(() => {
		if (!worksheet) return 0;
		const rowMeta = (worksheet as Record<string, unknown>)["!rows"] as
			| Array<{ hidden?: boolean } | undefined>
			| undefined;
		if (!rowMeta) return 0;
		return rowMeta.filter((m) => m?.hidden).length;
	}, [worksheet]);

	// When worksheet changes: fade out first, then swap and fade in
	useEffect(() => {
		if (!sheetHtml) return;

		if (displayedSheetHtml && displayedSheetHtml !== sheetHtml) {
			pendingSheetRef.current = { html: sheetHtml, stats: sheetStats };
			setIsFadingOut(true);
			return;
		}

		setDisplayedSheetHtml(sheetHtml);
		setDisplayedSheetStats(sheetStats);
		setScaleReady(false);
		pendingSheetRef.current = null;
		setIsFadingOut(false);

		const container = containerRef.current;
		const measureEl = measureWrapperRef.current;
		if (!container || !measureEl) return;

		const updateScale = () => {
			const cw = container.clientWidth;
			const tw = measureEl.offsetWidth;
			if (cw <= 0 || tw <= 0) {
				setScaleReady(true);
				return;
			}
			const ratio = cw / tw;
			if (ratio > 1) {
				setScale(Math.min(ratio, 1.6));
			}
			setScaleReady(true);
		};

		const raf = requestAnimationFrame(updateScale);
		const ro = new ResizeObserver(() => requestAnimationFrame(updateScale));
		ro.observe(container);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	}, [sheetHtml, sheetStats, displayedSheetHtml]);

	const handleFadeOutEnd = () => {
		if (!isFadingOut) return;
		const pending = pendingSheetRef.current;
		if (pending) {
			setDisplayedSheetHtml(pending.html);
			setDisplayedSheetStats(pending.stats);
			pendingSheetRef.current = null;
		}
		setIsFadingOut(false);
		setScaleReady(false);
	};

	if (!worksheet && !displayedSheetHtml) {
		return (
			<div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-500">
				No data available
			</div>
		);
	}

	const gridColor = "[&_td]:border-[#d4d4d4] [&_th]:border-[#d4d4d4]";

	const tableBaseClass = [
		"[&_table]:w-full [&_table]:border-collapse",
		"[&_table]:tabular-nums [&_table]:text-[#1e1e1e]",
		'[&_table]:font-[Calibri,"Segoe_UI",sans-serif]',
		// Cells: compact padding, full gridlines
		"[&_td]:px-[6px] [&_td]:py-[3px] [&_td]:whitespace-nowrap",
		"[&_td]:border [&_td]:border-solid",
		gridColor,
		// Headers
		"[&_th]:border [&_th]:border-solid [&_th]:px-[6px] [&_th]:py-[3px]",
		"[&_th]:text-left [&_th]:font-semibold",
		gridColor,
		// Numeric cells: right-aligned, tabular
		'[&_td[data-type="n"]]:text-right',
		// Row hover: faint blue tint like Excel cell selection
		"[&_tr:hover_td]:bg-[#e8f0fe]/40",
	].join(" ");

	const opacity = isFadingOut ? 0 : scaleReady ? 1 : 0;

	return (
		<div
			className={`relative flex flex-col overflow-hidden ${borderless ? "" : "border border-[#b4b4b4] rounded-sm"}`}
		>
			{showHidden && (
				<style>{`.inline-excel-sheet .xlsx-hidden { display: table-row !important; opacity: 0.45; }`}</style>
			)}
			{/* Hidden measurement div */}
			{displayedSheetHtml && (
				<div
					ref={measureWrapperRef}
					aria-hidden
					className={`absolute left-[-9999px] top-0 w-max ${tableBaseClass} [&_table]:text-[10px]`}
					style={{ visibility: "hidden" }}
					dangerouslySetInnerHTML={{ __html: displayedSheetHtml }}
				/>
			)}

			{/* Spreadsheet grid area */}
			<div
				ref={containerRef}
				className="inline-excel-sheet relative w-full flex-1 overflow-auto bg-white"
			>
				{displayedSheetHtml && (
					<div
						ref={tableWrapperRef}
						className="w-full"
						style={{
							fontSize: `${scale > 1 ? scale * 10 : 10}px`,
							opacity,
							transition: "opacity 0.1s ease-out",
						}}
						onTransitionEnd={(e) => {
							if (e.propertyName === "opacity" && isFadingOut) handleFadeOutEnd();
						}}
					>
						<div
							className={tableBaseClass}
							dangerouslySetInnerHTML={{ __html: displayedSheetHtml }}
						/>
					</div>
				)}
			</div>

			{/* Status bar — anchored at bottom like Excel */}
			{displayedSheetStats && (
				<div className="flex items-center justify-between shrink-0 px-2 py-[3px] bg-[#f3f3f3] border-t border-[#d4d4d4] text-[10px] text-[#616161] tabular-nums select-none font-[Calibri,'Segoe_UI',sans-serif]">
					<div className="flex items-center gap-2">
						<span>{displayedSheetStats.rows} rows</span>
						<span className="text-[#c4c4c4]">|</span>
						<span>{displayedSheetStats.cols} cols</span>
					</div>
					{hiddenRowCount > 0 && (
						<button
							onClick={() => setShowHidden((v) => !v)}
							className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-px transition-colors ${
								showHidden
									? "text-[#4338ca] bg-[#e0e7ff] hover:bg-[#c7d2fe]"
									: "text-[#616161] hover:text-[#1e1e1e] hover:bg-[#e5e5e5]"
							}`}
							title={showHidden ? "Hide empty sections" : "Show empty sections"}
						>
							{showHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
							<span>{hiddenRowCount} hidden</span>
						</button>
					)}
				</div>
			)}
		</div>
	);
}
