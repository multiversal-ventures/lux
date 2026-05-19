import type { WorkBook } from "@multiversal-ventures/xlsx";

export interface ReportSheetTabsProps {
	workbook: WorkBook;
	activeSheet: string;
	onSheetChange: (sheetName: string) => void;
	className?: string;
	tabClassName?: string;
	activeTabClassName?: string;
}

/**
 * Bottom strip of sheet names (Excel-style). Styling is host-controlled via className props.
 */
export function ReportSheetTabs({
	workbook,
	activeSheet,
	onSheetChange,
	className,
	tabClassName,
	activeTabClassName,
}: ReportSheetTabsProps) {
	const names = workbook.SheetNames ?? [];
	if (names.length <= 1) return null;

	return (
		<div className={className} role="tablist" aria-label="Worksheet tabs">
			<div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
				{names.map((name) => {
					const active = name === activeSheet;
					return (
						<button
							key={name}
							type="button"
							role="tab"
							aria-selected={active}
							onClick={() => onSheetChange(name)}
							className={active ? activeTabClassName : tabClassName}
						>
							{name}
						</button>
					);
				})}
			</div>
		</div>
	);
}
