import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { resolveApiUrl } from "../../lib/api";

interface TaxYearResolution {
	case_id: string;
	y1: string | null;
	y2: string | null;
	y3: string | null;
	confidence: number;
	needs_review: boolean;
	confirmed: boolean;
	confirmed_by: string | null;
	confirmed_at: string | null;
	source_documents: Array<{
		document_class: string;
		year: string;
		authority: number;
	}>;
	warnings: string[];
}

interface TaxYearConfidenceProps {
	caseId: string;
	onYearsChanged?: () => void;
}

// Map raw doc class to friendly name
const DOC_DISPLAY: Record<string, string> = {
	IRS1040: "1040",
	IRSW2: "W-2",
	IRS1065: "1065",
	IRS1120: "1120",
	IRS1120S: "1120-S",
	IRS1040ScheduleC: "Sched C",
	IRS1040ScheduleE: "Sched E",
	IRSScheduleK1Form1065: "K-1 (1065)",
	IRSScheduleK1Form1120S: "K-1 (1120S)",
	PayStub: "Pay Stub",
	BankStatement: "Bank Stmt",
};

const getDocDisplay = (docClass: string) => DOC_DISPLAY[docClass] || docClass;

export function TaxYearConfidence({ caseId }: TaxYearConfidenceProps) {
	const { user } = useAuth();
	const [resolution, setResolution] = useState<TaxYearResolution | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showModal, setShowModal] = useState(false);

	const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
		if (user) {
			const token = await user.getIdToken();
			return {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			};
		}
		return { "Content-Type": "application/json" };
	}, [user]);

	const fetchResolution = useCallback(async () => {
		try {
			setLoading(true);
			const headers = await getAuthHeaders();
			const response = await fetch(resolveApiUrl(`/api/v1/case/${caseId}/tax-year`), { headers });
			if (!response.ok) {
				throw new Error("Failed to fetch tax year resolution");
			}
			const data = await response.json();
			setResolution(data);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load tax year data");
		} finally {
			setLoading(false);
		}
	}, [caseId, getAuthHeaders]);

	useEffect(() => {
		fetchResolution();
	}, [fetchResolution]);

	if (loading || error || !resolution) return null;

	// Group source documents by year for the modal
	const docsByYear: Record<string, Array<{ document_class: string; authority: number }>> = {};
	resolution.source_documents.forEach((doc) => {
		if (!doc.year) return;
		if (!docsByYear[doc.year]) docsByYear[doc.year] = [];
		docsByYear[doc.year].push({ document_class: doc.document_class, authority: doc.authority });
	});
	// Sort years descending
	const sortedYears = Object.keys(docsByYear).sort((a, b) => Number(b) - Number(a));

	return (
		<>
			{/* Inline text link */}
			<button
				onClick={() => setShowModal(true)}
				className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
			>
				<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
				How are tax years detected?
			</button>

			{/* Modal */}
			{showModal && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
					onClick={() => setShowModal(false)}
				>
					<div
						className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-auto"
						onClick={(e) => e.stopPropagation()}
					>
						{/* Header */}
						<div className="p-4 border-b border-slate-200 flex items-center justify-between">
							<h3 className="font-semibold text-slate-800">Tax Year Detection</h3>
							<button
								onClick={() => setShowModal(false)}
								className="text-slate-400 hover:text-slate-600"
							>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>

						<div className="p-4 space-y-4">
							{/* Resolved years summary */}
							<div className="flex items-center gap-3">
								{resolution.y1 && (
									<div className="px-3 py-1.5 bg-slate-100 rounded-md">
										<span className="text-[10px] text-slate-400 block">Most recent</span>
										<span className="text-lg font-bold text-slate-800">{resolution.y1}</span>
									</div>
								)}
								{resolution.y2 && (
									<div className="px-3 py-1.5 bg-slate-100 rounded-md">
										<span className="text-[10px] text-slate-400 block">Prior year</span>
										<span className="text-lg font-bold text-slate-800">{resolution.y2}</span>
									</div>
								)}
								{resolution.y3 && (
									<div className="px-3 py-1.5 bg-slate-100 rounded-md">
										<span className="text-[10px] text-slate-400 block">3rd year</span>
										<span className="text-lg font-bold text-slate-800">{resolution.y3}</span>
									</div>
								)}
							</div>

							{/* Explanation */}
							<p className="text-sm text-slate-600">
								Tax years are auto-detected from your uploaded documents. Years with{" "}
								<span className="font-medium text-green-700">authoritative tax returns</span> (1040,
								W-2) are prioritized over years with only supporting documents (pay stubs, bank
								statements).
							</p>

							{/* Authority Legend */}
							<div className="bg-slate-50 rounded-md p-3">
								<h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">
									Document Priority
								</h4>
								<div className="grid grid-cols-2 gap-2 text-xs">
									<div className="flex items-center gap-2">
										<span className="w-2 h-2 rounded-full bg-green-500"></span>
										<span className="text-slate-600">Tax Returns (1040, W-2)</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="w-2 h-2 rounded-full bg-blue-500"></span>
										<span className="text-slate-600">Business (1065, K-1)</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="w-2 h-2 rounded-full bg-slate-400"></span>
										<span className="text-slate-600">Schedules, 1099s</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="w-2 h-2 rounded-full bg-slate-300"></span>
										<span className="text-slate-600">Pay Stubs, Bank Stmts</span>
									</div>
								</div>
							</div>

							{/* Year frequency */}
							{sortedYears.length > 0 && (
								<div className="flex flex-wrap gap-4">
									{sortedYears.map((year) => {
										// Check if this year has authoritative docs (authority >= 9)
										const hasAuthoritative = docsByYear[year].some((d) => d.authority >= 9);
										const isSelected =
											year === resolution.y1 || year === resolution.y2 || year === resolution.y3;
										return (
											<div
												key={year}
												className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${
													isSelected ? "bg-green-50 border border-green-200" : ""
												}`}
											>
												<span className="font-medium text-slate-700">{year}</span>
												<span className="text-slate-400">
													{docsByYear[year].length} doc{docsByYear[year].length !== 1 ? "s" : ""}
												</span>
												{hasAuthoritative && (
													<span
														className="w-2 h-2 rounded-full bg-green-500"
														title="Has tax returns"
													></span>
												)}
											</div>
										);
									})}
								</div>
							)}

							{/* Documents grouped by year */}
							{sortedYears.length > 0 && (
								<div>
									<h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">
										Documents by year
									</h4>
									<div className="space-y-3">
										{sortedYears.map((year) => (
											<div key={year}>
												<div className="text-sm font-semibold text-slate-700 mb-1">{year}</div>
												<div className="flex flex-wrap gap-1.5">
													{docsByYear[year]
														.sort((a, b) => b.authority - a.authority)
														.map((doc, idx) => (
															<span
																key={idx}
																className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${
																	doc.authority >= 9
																		? "bg-green-100 text-green-800"
																		: doc.authority >= 7
																			? "bg-blue-100 text-blue-800"
																			: doc.authority >= 4
																				? "bg-slate-100 text-slate-700"
																				: "bg-slate-50 text-slate-500"
																}`}
															>
																{getDocDisplay(doc.document_class)}
															</span>
														))}
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Warnings */}
							{resolution.warnings.length > 0 && (
								<div className="bg-amber-50 border border-amber-200 rounded-md p-3">
									<h4 className="text-xs font-semibold text-amber-700 mb-1">Heads up</h4>
									<div className="text-xs text-amber-700 space-y-1">
										{resolution.warnings.slice(0, 5).map((w, i) => (
											<div key={i}>{w}</div>
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	);
}
