import { useMemo } from "react";
import { AlertCircle, Info } from "lucide-react";

type ProductCategory = "qm" | "bank_statement" | "1099";

function getProductCategory(approach?: string, loanProductIds: string[] = []): ProductCategory {
	if (approach === "non_qualified_mortgage") {
		const ids = loanProductIds.map((id) => id.toLowerCase());
		if (ids.some((id) => id.includes("1099"))) return "1099";
		if (ids.some((id) => id.includes("bank_statement"))) return "bank_statement";
		return "1099";
	}
	return "qm";
}

interface PeriodsTabProps {
	y1Override: string | null;
	y2Override: string | null;
	onY1Change: (value: string | null) => void;
	onY2Change: (value: string | null) => void;
	/** Available years from document effective dates */
	availableYears?: string[];
	/** Explanation of why the auto-detected years were selected */
	yearSelectionReason?: string | null;
	/** Scenario approach -- primary signal for which variant to render */
	approach?: "qualified_mortgage" | "non_qualified_mortgage";
	/** Loan product IDs from the scenario -- used to distinguish Non-QM subtypes */
	loanProductIds?: string[];
	/** Bank statement period in months (Non-QM only) */
	statementPeriodMonths?: number | null;
	/** Callback for bank statement period change */
	onStatementPeriodChange?: (months: number | null) => void;
}

/**
 * PeriodsTab - Product-aware period configuration for scenario refinement.
 *
 * Renders different controls depending on loan product type:
 * - QM (fannie_mae, fha, etc.): Tax Year Overrides (Y1/Y2 dropdowns)
 * - Bank Statement (Non-QM):    Statement Period (months dropdown)
 * - 1099 (Non-QM):              Number of Years (1 or 2)
 */
export function PeriodsTab({
	y1Override,
	y2Override,
	onY1Change,
	onY2Change,
	availableYears = [],
	yearSelectionReason,
	approach,
	loanProductIds = [],
	statementPeriodMonths,
	onStatementPeriodChange,
}: PeriodsTabProps) {
	const category = useMemo(
		() => getProductCategory(approach, loanProductIds),
		[approach, loanProductIds],
	);

	if (category === "bank_statement") {
		return (
			<BankStatementPeriod
				statementPeriodMonths={statementPeriodMonths ?? null}
				onStatementPeriodChange={onStatementPeriodChange ?? (() => {})}
				availableYears={availableYears}
			/>
		);
	}

	if (category === "1099") {
		return (
			<NumberOfYears
				y1Override={y1Override}
				y2Override={y2Override}
				onY1Change={onY1Change}
				onY2Change={onY2Change}
				availableYears={availableYears}
			/>
		);
	}

	return (
		<TaxYearOverrides
			y1Override={y1Override}
			y2Override={y2Override}
			onY1Change={onY1Change}
			onY2Change={onY2Change}
			availableYears={availableYears}
			yearSelectionReason={yearSelectionReason}
		/>
	);
}

// ---------------------------------------------------------------------------
// QM: Tax Year Overrides (original behavior)
// ---------------------------------------------------------------------------

function TaxYearOverrides({
	y1Override,
	y2Override,
	onY1Change,
	onY2Change,
	availableYears,
	yearSelectionReason,
}: {
	y1Override: string | null;
	y2Override: string | null;
	onY1Change: (v: string | null) => void;
	onY2Change: (v: string | null) => void;
	availableYears: string[];
	yearSelectionReason?: string | null;
}) {
	const years = useMemo(() => {
		if (availableYears.length > 0) {
			return [...new Set(availableYears)].sort((a, b) => Number(b) - Number(a));
		}
		const currentYear = new Date().getFullYear();
		return Array.from({ length: 5 }, (_, i) => String(currentYear - i));
	}, [availableYears]);

	const validationError = useMemo(() => {
		if (!y1Override || !y2Override) return null;
		const y1 = Number(y1Override);
		const y2 = Number(y2Override);
		if (y1 === y2) return "Year 1 and Year 2 cannot be the same";
		if (y1 < y2) return "Year 1 must be more recent than Year 2";
		return null;
	}, [y1Override, y2Override]);

	const y2Years = useMemo(() => {
		if (!y1Override) return years;
		const y1Num = Number(y1Override);
		return years.filter((y) => Number(y) < y1Num);
	}, [years, y1Override]);

	const y1Years = useMemo(() => {
		if (!y2Override) return years;
		const y2Num = Number(y2Override);
		return years.filter((y) => Number(y) > y2Num);
	}, [years, y2Override]);

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-sm font-medium text-slate-800 mb-1">Tax Year Overrides</h3>
				<p className="text-sm text-slate-500">
					Override the automatically detected tax years for the 2-year income average calculation.
				</p>
			</div>

			<div className="grid grid-cols-2 gap-6 max-w-md">
				<div>
					<label className="block text-sm font-medium text-slate-700 mb-1">
						Year 1 (Most Recent)
					</label>
					<select
						value={y1Override ?? ""}
						onChange={(e) => onY1Change(e.target.value || null)}
						className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
							validationError ? "border-red-300" : "border-slate-300"
						}`}
					>
						<option value="">Auto-detect</option>
						{y1Years.map((year) => (
							<option key={year} value={year}>
								{year}
							</option>
						))}
					</select>
				</div>

				<div>
					<label className="block text-sm font-medium text-slate-700 mb-1">Year 2</label>
					<select
						value={y2Override ?? ""}
						onChange={(e) => onY2Change(e.target.value || null)}
						className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
							validationError ? "border-red-300" : "border-slate-300"
						}`}
					>
						<option value="">Auto-detect</option>
						{y2Years.map((year) => (
							<option key={year} value={year}>
								{year}
							</option>
						))}
					</select>
				</div>
			</div>

			{validationError && (
				<div className="flex items-center gap-2 text-sm text-red-600">
					<AlertCircle className="w-4 h-4 shrink-0" />
					{validationError}
				</div>
			)}

			{availableYears.length > 0 && (
				<div className="space-y-1">
					{!y1Override && !y2Override && yearSelectionReason && (
						<p className="text-xs text-emerald-600">{yearSelectionReason}</p>
					)}
					<p className="text-xs text-slate-400">
						Years available from documents: {years.join(", ")}
					</p>
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Non-QM Bank Statement: Statement Period (months)
// ---------------------------------------------------------------------------

function BankStatementPeriod({
	statementPeriodMonths,
	onStatementPeriodChange,
	availableYears,
}: {
	statementPeriodMonths: number | null;
	onStatementPeriodChange: (months: number | null) => void;
	availableYears: string[];
}) {
	const detectedMonths = useMemo(() => {
		if (availableYears.length < 1) return null;
		const sorted = [...availableYears].sort((a, b) => Number(a) - Number(b));
		const minYear = Number(sorted[0]);
		const maxYear = Number(sorted[sorted.length - 1]);
		return (maxYear - minYear + 1) * 12;
	}, [availableYears]);

	const detectedLabel = useMemo(() => {
		if (availableYears.length < 1) return null;
		const sorted = [...availableYears].sort((a, b) => Number(a) - Number(b));
		const minYear = sorted[0];
		const maxYear = sorted[sorted.length - 1];
		const months = (Number(maxYear) - Number(minYear) + 1) * 12;
		return `Bank Statements (${minYear}\u2013${maxYear}) : ${months} months detected`;
	}, [availableYears]);

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-sm font-medium text-amber-700 mb-1">Statement Period</h3>
				<p className="text-sm text-slate-500">
					Set the number of months of bank statements used for income averaging. Default is based on
					documents uploaded.
				</p>
			</div>

			<div className="max-w-md">
				<select
					value={statementPeriodMonths ?? detectedMonths ?? 24}
					onChange={(e) => {
						const val = Number(e.target.value);
						onStatementPeriodChange(val || null);
					}}
					className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
				>
					<option value={24}>24 months</option>
					<option value={12}>12 months</option>
					<option value={6}>6 months</option>
					<option value={3}>3 months</option>
				</select>
			</div>

			{detectedLabel && (
				<div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
					<Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
					<div>
						<span className="font-medium text-slate-600 uppercase text-[10px] tracking-wide">
							Auto-detected from documents
						</span>
						<br />
						{detectedLabel}
					</div>
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Non-QM 1099: Number of Years
// ---------------------------------------------------------------------------

function NumberOfYears({
	y1Override,
	y2Override,
	onY1Change,
	onY2Change,
	availableYears,
}: {
	y1Override: string | null;
	y2Override: string | null;
	onY1Change: (v: string | null) => void;
	onY2Change: (v: string | null) => void;
	availableYears: string[];
}) {
	const years = useMemo(() => {
		if (availableYears.length > 0) {
			return [...new Set(availableYears)].sort((a, b) => Number(b) - Number(a));
		}
		const currentYear = new Date().getFullYear();
		return [String(currentYear), String(currentYear - 1)];
	}, [availableYears]);

	const mostRecent = years[0] ?? String(new Date().getFullYear());
	const priorYear = years[1] ?? String(Number(mostRecent) - 1);

	// Derive current selection: "1" if y2Override is explicitly cleared, else "2"
	const numYears = useMemo(() => {
		if (y1Override && !y2Override) return "1";
		return "2";
	}, [y1Override, y2Override]);

	const handleChange = (value: string) => {
		if (value === "1") {
			onY1Change(mostRecent);
			onY2Change(null);
		} else {
			onY1Change(null);
			onY2Change(null);
		}
	};

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-sm font-medium text-amber-700 mb-1">Number of Years</h3>
				<p className="text-sm text-slate-500">
					Set the number of years of 1099 income used for the calculation. Default is based on
					documents submitted.
				</p>
			</div>

			<div className="max-w-md">
				<select
					value={numYears}
					onChange={(e) => handleChange(e.target.value)}
					className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
				>
					<option value="2">
						2 years ({mostRecent} &amp; {priorYear})
					</option>
					<option value="1">1 year ({mostRecent} only)</option>
				</select>
			</div>

			{availableYears.length > 0 && (
				<div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
					<Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
					<div>
						<span className="font-medium text-slate-600 uppercase text-[10px] tracking-wide">
							Auto-detected from documents
						</span>
						<br />
						{years.length} year{years.length !== 1 ? "s" : ""} detected: {years.join(", ")}
					</div>
				</div>
			)}
		</div>
	);
}

export default PeriodsTab;
