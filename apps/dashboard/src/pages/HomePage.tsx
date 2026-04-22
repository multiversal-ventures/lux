import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DropZone } from "../components/upload";
import { CasesTable } from "../components/CasesTable";
import { useUpload, useCaseHistory } from "../hooks";
import { listSamples, createSampleCase, type SampleInfo } from "../hooks/useApi";
import {
	trackFileUploadStarted,
	trackFileUploadCompleted,
	trackFileUploadFailed,
	trackFunnelStep,
} from "../lib/analytics";
import {
	Check,
	FileText,
	Building2,
	Receipt,
	Loader2,
	ChevronRight,
	ChevronDown,
} from "lucide-react";

// localStorage keys for remembering user's last selection (UX convenience only)
const FIRST_SCENARIO_DEFAULT_KEY = "first_scenario_type";
const FIRST_SCENARIO_NQM_PRODUCTS_KEY = "first_scenario_nqm_products";

const NQM_PRODUCTS = [
	{ id: "non_qm_bank_statement", displayName: "Bank Statements" },
	{ id: "irs_1099_income", displayName: "1099 Income" },
] as const;

function parseNqmProducts(stored: string | null): string[] {
	if (!stored) return ["non_qm_bank_statement"];
	try {
		const parsed = JSON.parse(stored) as unknown;
		if (Array.isArray(parsed) && parsed.every((p) => typeof p === "string")) {
			const canonical = parsed.map((p) => (p === "bank_statement" ? "non_qm_bank_statement" : p));
			const valid = canonical.filter((p) => NQM_PRODUCTS.some((n) => n.id === p));
			return valid.length > 0 ? valid : ["non_qm_bank_statement"];
		}
	} catch {
		/* ignore */
	}
	return ["non_qm_bank_statement"];
}

interface CategoryGroupProps {
	category: string;
	title: string;
	subtitle: string;
	icon: React.ReactNode;
	iconBg: string;
	iconBgHover: string;
	tags: { label: string; color: string }[];
	samples: SampleInfo[];
	expanded: boolean;
	onToggle: () => void;
	onSelect: (sample: SampleInfo) => void;
	creatingSampleId: string | null;
}

function CategoryGroup({
	title,
	subtitle,
	icon,
	iconBg,
	iconBgHover,
	tags,
	samples,
	expanded,
	onToggle,
	onSelect,
	creatingSampleId,
}: CategoryGroupProps) {
	return (
		<div className="rounded-lg border border-slate-200 overflow-hidden">
			<button
				type="button"
				onClick={onToggle}
				disabled={!!creatingSampleId}
				className="w-full text-left p-4 hover:bg-slate-50 transition-all group disabled:opacity-60"
			>
				<div className="flex items-start gap-3">
					<div
						className={`flex-shrink-0 w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center ${iconBgHover} transition-colors`}
					>
						{icon}
					</div>
					<div className="flex-1 min-w-0">
						<p className="text-sm font-semibold text-slate-900">{title}</p>
						<p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
						<div className="flex flex-wrap gap-1.5 mt-2">
							{tags.map((t) => (
								<span
									key={t.label}
									className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${t.color}`}
								>
									{t.label}
								</span>
							))}
						</div>
					</div>
					{expanded ? (
						<ChevronDown className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5 transition-colors" />
					) : (
						<ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-orange-500 flex-shrink-0 mt-0.5 transition-colors" />
					)}
				</div>
			</button>

			{expanded && samples.length > 0 && (
				<div className="border-t border-slate-100 bg-slate-50/50">
					{samples.map((s) => {
						const isCreating = creatingSampleId === s.id;
						const isDisabled = !!creatingSampleId;
						return (
							<button
								key={s.id}
								type="button"
								onClick={() => onSelect(s)}
								disabled={isDisabled}
								className="w-full text-left px-4 py-3 pl-[4.25rem] hover:bg-orange-50 transition-colors border-t border-slate-100 first:border-t-0 disabled:opacity-60 disabled:cursor-not-allowed"
							>
								<div className="flex items-center gap-3">
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium text-slate-800">{s.name}</p>
										<p className="text-xs text-slate-500 mt-0.5">{s.description}</p>
									</div>
									{isCreating ? (
										<Loader2 className="w-4 h-4 text-orange-500 animate-spin flex-shrink-0" />
									) : (
										<ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
									)}
								</div>
								{s.files.length > 0 && (
									<div className="mt-2 space-y-1">
										{s.files.map((f, idx) => (
											<div
												key={idx}
												className="flex items-center gap-2 py-1 px-2 bg-white/70 rounded border border-slate-100"
											>
												<FileText className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
												<span className="text-xs text-slate-600 truncate">{f.filename}</span>
											</div>
										))}
									</div>
								)}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}

export function HomePage() {
	const navigate = useNavigate();
	const { loading, error, upload, uploadingFiles, uploadProgress, phase } = useUpload();
	const { cases, addCase, updateCaseProgress, removeCase } = useCaseHistory();

	// Case setup state
	const [caseName, setCaseName] = useState("");
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [showNewCaseForm, setShowNewCaseForm] = useState(false);
	const [showSamplesModal, setShowSamplesModal] = useState(false);
	const [samples, setSamples] = useState<SampleInfo[]>([]);
	const [samplesLoading, setSamplesLoading] = useState(false);
	const [samplesError, setSamplesError] = useState<string | null>(null);
	const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
	const [creatingSampleId, setCreatingSampleId] = useState<string | null>(null);

	// First scenario type - default from last used; per-case stored when creating
	const [incomeVerificationType, setIncomeVerificationType] = useState<"qm" | "nqm">(() => {
		const stored = localStorage.getItem(FIRST_SCENARIO_DEFAULT_KEY);
		return stored === "qm" || stored === "nqm" ? stored : "qm";
	});

	// NQM product selection - Bank Statements, 1099 Income, or both
	const [nqmProductIds, setNqmProductIds] = useState<string[]>(() =>
		parseNqmProducts(localStorage.getItem(FIRST_SCENARIO_NQM_PRODUCTS_KEY)),
	);

	useEffect(() => {
		localStorage.setItem(FIRST_SCENARIO_DEFAULT_KEY, incomeVerificationType);
	}, [incomeVerificationType]);

	useEffect(() => {
		if (incomeVerificationType === "nqm") {
			localStorage.setItem(FIRST_SCENARIO_NQM_PRODUCTS_KEY, JSON.stringify(nqmProductIds));
		}
	}, [incomeVerificationType, nqmProductIds]);

	const toggleNqmProduct = (id: string) => {
		setNqmProductIds((prev) => {
			const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
			return next.length > 0 ? next : prev; // At least one must remain
		});
	};

	const handleFilesSelected = (files: File[]) => {
		// Append files across multiple picks so users can collect docs from different folders.
		setSelectedFiles((prev) => {
			if (prev.length === 0) return files;

			const existingKeys = new Set(
				prev.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
			);
			const next = [...prev];

			for (const file of files) {
				const key = `${file.name}:${file.size}:${file.lastModified}`;
				if (!existingKeys.has(key)) {
					existingKeys.add(key);
					next.push(file);
				}
			}

			return next;
		});
	};

	const handleCreateCase = async () => {
		if (selectedFiles.length === 0) return;

		const startTime = Date.now();

		trackFileUploadStarted({
			file_count: selectedFiles.length,
			total_size_bytes: selectedFiles.reduce((sum, f) => sum + f.size, 0),
			file_types: selectedFiles.map((f) => f.name.split(".").pop() || "unknown"),
		});

		try {
			const pendingFiles = selectedFiles.map((f, idx) => ({
				filename: f.name,
				tempId: `pending-${idx}`,
			}));

			// Build income config based on verification type
			// QM: Run all standard loan products (Fannie Mae, Freddie Mac, FHA, USDA)
			// Non-QM: Run selected products (bank_statement, irs_1099_income)
			const uploadOptions =
				incomeVerificationType === "qm"
					? {
							loanProductIds: ["fannie_mae", "freddie_mac", "fha", "usda"],
						}
					: {
							loanProductIds: nqmProductIds,
							calculationTrack: nqmProductIds.includes("non_qm_bank_statement")
								? "non_qm_bank_statement"
								: undefined,
						};

			const result = await upload(selectedFiles, uploadOptions);

			trackFileUploadCompleted({
				case_id: result.case_id,
				file_count: result.file_count,
				duration_ms: Date.now() - startTime,
			});
			trackFunnelStep({ case_id: result.case_id, step: "upload" });

			const nameToUse = caseName.trim() || "New Case";
			addCase(result.case_id, result.file_count, nameToUse);
			updateCaseProgress(result.case_id, "processing");

			setCaseName("");
			setSelectedFiles([]);
			setShowNewCaseForm(false);

			navigate(`/case/${result.case_id}`, {
				state: {
					pendingFiles,
					caseName: nameToUse,
					caseId: result.case_id,
					incomeVerificationType,
				},
			});
		} catch (err) {
			trackFileUploadFailed({
				error_message: err instanceof Error ? err.message : "Unknown error",
				file_count: selectedFiles.length,
			});
		}
	};

	const handleCancelNewCase = () => {
		setCaseName("");
		setSelectedFiles([]);
		setShowNewCaseForm(false);
	};

	const openSamplesModal = useCallback(async () => {
		setShowSamplesModal(true);
		setExpandedCategory(null);
		setCreatingSampleId(null);
		setSamplesError(null);
		if (samples.length === 0) {
			setSamplesLoading(true);
			try {
				const res = await listSamples();
				setSamples(res.samples);
			} catch (err) {
				setSamplesError(err instanceof Error ? err.message : "Failed to load samples");
			} finally {
				setSamplesLoading(false);
			}
		}
	}, [samples.length]);

	const handleCreateSample = async (sample: SampleInfo) => {
		setCreatingSampleId(sample.id);
		setSamplesError(null);
		try {
			const result = await createSampleCase(sample.id, `Sample: ${sample.name}`);
			addCase(result.case_id, result.file_count, `Sample: ${sample.name}`);
			updateCaseProgress(result.case_id, "processing");
			setShowSamplesModal(false);
			setCreatingSampleId(null);
			navigate(`/case/${result.case_id}`, {
				state: {
					caseName: `Sample: ${sample.name}`,
					caseId: result.case_id,
				},
			});
		} catch (err) {
			setSamplesError(err instanceof Error ? err.message : "Failed to create sample case");
			setCreatingSampleId(null);
		}
	};

	return (
		<div className="h-full flex flex-col overflow-hidden bg-slate-50">
			{/* Main Content Area */}
			<div className="flex-1 overflow-y-auto p-6">
				<div className="max-w-6xl mx-auto">
					{/* Cases Table */}
					<CasesTable
						cases={cases}
						onRemove={removeCase}
						onNewCase={() => setShowNewCaseForm(true)}
						onSamples={openSamplesModal}
					/>
				</div>
			</div>

			{/* New Case Modal */}
			{showNewCaseForm ? (
				<div className="fixed inset-0 z-50 p-5 flex items-center justify-center">
					{/* Backdrop - full viewport, behind content */}
					<div className="absolute inset-0 bg-black/50 -z-10" onClick={handleCancelNewCase} />
					{/* Modal - fills 100vh - 40px */}
					<div
						className="relative flex flex-col min-h-0 w-full max-w-2xl overflow-hidden bg-white rounded-xl shadow-2xl"
						style={{ maxHeight: "calc(100vh - 40px)" }}
					>
						<div className="p-5 flex flex-col flex-1 min-h-0">
							{/* Case Name Input */}
							<div className="mb-4 flex-shrink-0">
								<label
									htmlFor="case-name"
									className="block text-sm font-medium text-slate-700 mb-1.5"
								>
									Case Name
								</label>
								<input
									id="case-name"
									type="text"
									value={caseName}
									onChange={(e) => setCaseName(e.target.value)}
									placeholder="Enter case name..."
									className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
								/>
							</div>

							{/* Income Verification Type Selector */}
							<div className="mb-4 flex-shrink-0">
								<label className="block text-sm font-medium text-slate-700 mb-1.5">
									Income Verification Type *
								</label>
								<div className="flex gap-2 mb-2">
									<button
										type="button"
										onClick={() => setIncomeVerificationType("qm")}
										className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
											incomeVerificationType === "qm"
												? "bg-orange-600 text-white"
												: "bg-slate-100 text-slate-600 hover:bg-slate-200"
										}`}
									>
										Qualified Mortgage
									</button>
									<button
										type="button"
										onClick={() => setIncomeVerificationType("nqm")}
										className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
											incomeVerificationType === "nqm"
												? "bg-orange-600 text-white"
												: "bg-slate-100 text-slate-600 hover:bg-slate-200"
										}`}
									>
										Non-Qualified Mortgage
									</button>
								</div>
								<div className="bg-white rounded-lg border border-slate-200 p-3">
									{incomeVerificationType === "qm" ? (
										<>
											<div className="flex items-center gap-2 text-slate-700 mb-2">
												<Check className="w-4 h-4 text-orange-600 flex-shrink-0" />
												<span className="text-sm font-medium">All loan products will be run</span>
											</div>
											<div className="flex flex-wrap gap-1.5">
												{["Fannie Mae", "Freddie Mac", "FHA", "USDA"].map((name) => (
													<span
														key={name}
														className="px-2.5 py-1 text-xs font-medium rounded-full border border-orange-200 bg-orange-50 text-orange-800"
													>
														{name}
													</span>
												))}
												<span className="px-2.5 py-1 text-xs font-medium rounded-full border border-slate-200 bg-slate-100 text-slate-400">
													VA Soon
												</span>
											</div>
										</>
									) : (
										<>
											<p className="text-sm text-slate-600 mb-2">Select product types to run:</p>
											<div className="flex flex-wrap gap-1.5">
												{NQM_PRODUCTS.map((product) => (
													<button
														key={product.id}
														type="button"
														onClick={() => toggleNqmProduct(product.id)}
														className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-all ${
															nqmProductIds.includes(product.id)
																? "border-orange-200 bg-orange-50 text-orange-800"
																: "border-slate-200 bg-slate-100 text-slate-400 hover:bg-slate-200"
														}`}
													>
														{product.displayName}
													</button>
												))}
												<span className="px-2.5 py-1 text-xs font-medium rounded-full border border-slate-200 bg-slate-100 text-slate-400">
													DSCR Soon
												</span>
											</div>
										</>
									)}
								</div>
							</div>

							{/* Drop Zone + Files List (stretches, scrollable) */}
							<div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-slate-200 flex flex-col">
								<DropZone
									onFilesSelected={handleFilesSelected}
									loading={loading}
									uploadingFiles={uploadingFiles}
									uploadProgress={uploadProgress}
									uploadPhase={phase}
									className="m-2.5"
								/>

								{/* Show selected files before upload */}
								{selectedFiles.length > 0 && !loading && (
									<div className="mt-2 p-3 bg-slate-50 rounded-b-lg border-t border-slate-200">
										<div className="flex items-center justify-between mb-1.5">
											<p className="text-sm font-medium text-slate-700">
												Selected Files ({selectedFiles.length})
											</p>
											<button
												type="button"
												onClick={() => setSelectedFiles([])}
												className="text-xs font-medium text-slate-500 hover:text-slate-700"
											>
												Clear
											</button>
										</div>
										<p className="text-xs text-slate-500 mb-2">
											You can add more files by selecting again from another folder.
										</p>
										<div className="space-y-1.5">
											{selectedFiles.map((file, idx) => (
												<div
													key={idx}
													className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200"
												>
													<div className="flex-shrink-0 w-7 h-7 rounded bg-orange-100 flex items-center justify-center">
														<svg
															className="w-4 h-4 text-orange-600"
															fill="none"
															viewBox="0 0 24 24"
															stroke="currentColor"
														>
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={2}
																d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
															/>
														</svg>
													</div>
													<div className="flex-1 min-w-0">
														<p className="text-sm font-medium text-slate-700 truncate">
															{file.name}
														</p>
														<p className="text-xs text-slate-500">
															{(file.size / 1024).toFixed(1)} KB
														</p>
													</div>
												</div>
											))}
										</div>
									</div>
								)}
							</div>

							{error && (
								<div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex-shrink-0">
									<strong>Error:</strong> {error}
								</div>
							)}

							{/* Action Buttons */}
							<div className="mt-4 flex gap-2 justify-end flex-shrink-0">
								<button
									type="button"
									onClick={handleCancelNewCase}
									className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 transition-all"
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={handleCreateCase}
									disabled={
										selectedFiles.length === 0 ||
										loading ||
										(incomeVerificationType === "nqm" && nqmProductIds.length === 0)
									}
									className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-orange-600"
								>
									Create Case
								</button>
							</div>
						</div>
					</div>
				</div>
			) : null}

			{/* Samples Modal */}
			{showSamplesModal ? (
				<div className="fixed inset-0 z-50 p-5 flex items-center justify-center">
					<div
						className="absolute inset-0 bg-black/50 -z-10"
						onClick={() => !creatingSampleId && setShowSamplesModal(false)}
					/>
					<div
						className="relative flex flex-col min-h-0 w-full max-w-2xl overflow-hidden bg-white rounded-xl shadow-2xl"
						style={{ maxHeight: "calc(100vh - 40px)" }}
					>
						<div className="p-5 flex flex-col min-h-0 flex-1 overflow-hidden">
							<div className="flex items-center justify-between mb-1">
								<h2 className="text-lg font-semibold text-slate-900">Sample Cases</h2>
								<button
									type="button"
									onClick={() => !creatingSampleId && setShowSamplesModal(false)}
									className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
								>
									<svg
										className="w-5 h-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={2}
									>
										<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
							<p className="text-sm text-slate-500 mb-4 flex-shrink-0">
								Pick a category, then choose a sample to create a case.
							</p>

							<div className="flex-1 min-h-0 overflow-y-auto">
								{samplesLoading ? (
									<div className="flex items-center justify-center py-8">
										<Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
										<span className="ml-2 text-sm text-slate-500">Loading samples...</span>
									</div>
								) : samplesError && samples.length === 0 ? (
									<div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
										{samplesError}
									</div>
								) : (
									<div className="space-y-3">
										<CategoryGroup
											category="irs"
											title="IRS Tax Returns (QM)"
											subtitle="W-2, 1040, Schedule C, K-1"
											icon={<FileText className="w-5 h-5" />}
											iconBg="bg-blue-100 text-blue-600"
											iconBgHover="group-hover:bg-blue-200"
											tags={[
												{ label: "Fannie Mae", color: "bg-blue-50 text-blue-700 border-blue-200" },
												{ label: "Freddie Mac", color: "bg-blue-50 text-blue-700 border-blue-200" },
												{ label: "FHA", color: "bg-blue-50 text-blue-700 border-blue-200" },
												{ label: "USDA", color: "bg-blue-50 text-blue-700 border-blue-200" },
											]}
											samples={samples.filter((s) => s.category === "irs")}
											expanded={expandedCategory === "irs"}
											onToggle={() =>
												setExpandedCategory(expandedCategory === "irs" ? null : "irs")
											}
											onSelect={handleCreateSample}
											creatingSampleId={creatingSampleId}
										/>

										<CategoryGroup
											category="nqm_bank"
											title="Non-QM — Bank Statements"
											subtitle="Personal / business bank statements"
											icon={<Building2 className="w-5 h-5" />}
											iconBg="bg-emerald-100 text-emerald-600"
											iconBgHover="group-hover:bg-emerald-200"
											tags={[
												{
													label: "Bank Statements",
													color: "bg-emerald-50 text-emerald-700 border-emerald-200",
												},
											]}
											samples={samples.filter((s) => s.category === "nqm_bank")}
											expanded={expandedCategory === "nqm_bank"}
											onToggle={() =>
												setExpandedCategory(expandedCategory === "nqm_bank" ? null : "nqm_bank")
											}
											onSelect={handleCreateSample}
											creatingSampleId={creatingSampleId}
										/>

										<CategoryGroup
											category="nqm_1099"
											title="Non-QM — 1099 Income"
											subtitle="1099-NEC, 1099-MISC, 1099-R"
											icon={<Receipt className="w-5 h-5" />}
											iconBg="bg-violet-100 text-violet-600"
											iconBgHover="group-hover:bg-violet-200"
											tags={[
												{
													label: "1099 Income",
													color: "bg-violet-50 text-violet-700 border-violet-200",
												},
											]}
											samples={samples.filter((s) => s.category === "nqm_1099")}
											expanded={expandedCategory === "nqm_1099"}
											onToggle={() =>
												setExpandedCategory(expandedCategory === "nqm_1099" ? null : "nqm_1099")
											}
											onSelect={handleCreateSample}
											creatingSampleId={creatingSampleId}
										/>
									</div>
								)}

								{samplesError && samples.length > 0 && (
									<div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
										{samplesError}
									</div>
								)}
							</div>

							<div className="mt-4 flex justify-end flex-shrink-0">
								<button
									type="button"
									onClick={() => !creatingSampleId && setShowSamplesModal(false)}
									disabled={!!creatingSampleId}
									className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 transition-all disabled:opacity-50"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
