import { useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { reprocessCase } from "../../hooks/useApi";
import { useWorkflowStatus } from "../../hooks/useCaseQueries";
import { useAppSelector } from "../../store";

interface Tab {
	id: string;
	label: string;
	count?: number;
	/** Tab is locked (Coming Soon) - no navigation */
	locked?: boolean;
	disabled?: boolean;
}

interface TabNavProps {
	tabs: Tab[];
	basePath: string;
	/** Case ID for reprocess functionality */
	caseId?: string;
	disabled?: boolean;
	/** When true, hide the tab strip but keep workflow indicator and Reprocess button */
	hideTabs?: boolean;
}

export function TabNav({ tabs, basePath, caseId, hideTabs }: TabNavProps) {
	const navigate = useNavigate();
	const [showReprocessMenu, setShowReprocessMenu] = useState(false);
	const [reprocessing, setReprocessing] = useState(false);
	const [selectedReplacementFiles, setSelectedReplacementFiles] = useState<File[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const selectedLoanProduct = useAppSelector((state) => state.app.selectedLoanProduct);

	// Workflow status - uses React Query (no polling, relies on SSE invalidation)
	const { data: workflowStatus } = useWorkflowStatus(caseId ?? null);
	const runningWorkflows = useMemo(
		() => workflowStatus?.workflows.filter((w) => w.status === "running") ?? [],
		[workflowStatus],
	);

	const handleReprocessSameFiles = async () => {
		if (!caseId || reprocessing) return;

		setReprocessing(true);
		setShowReprocessMenu(false);

		try {
			const result = await reprocessCase(caseId, undefined, selectedLoanProduct, true);
			if (result.new_case_id !== caseId) {
				navigate(`/case/${result.new_case_id}`);
			} else {
				window.location.reload();
			}
		} catch (err) {
			console.error("Reprocess failed:", err);
			alert("Failed to reprocess case");
		} finally {
			setReprocessing(false);
		}
	};

	const handleUploadNewFiles = () => {
		fileInputRef.current?.click();
	};

	const mergeSelectedFiles = (incomingFiles: File[]) => {
		setSelectedReplacementFiles((prev) => {
			if (prev.length === 0) return incomingFiles;

			const keys = new Set(prev.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
			const merged = [...prev];
			for (const file of incomingFiles) {
				const key = `${file.name}:${file.size}:${file.lastModified}`;
				if (!keys.has(key)) {
					keys.add(key);
					merged.push(file);
				}
			}
			return merged;
		});
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const input = e.target;
		const files = input.files;
		if (!files || files.length === 0 || !caseId) return;

		mergeSelectedFiles(Array.from(files));
		setShowReprocessMenu(true);

		// Allow selecting the same file(s) again in a later pick.
		input.value = "";
	};

	const handleReplaceWithSelectedFiles = async () => {
		if (!caseId || reprocessing || selectedReplacementFiles.length === 0) return;

		setReprocessing(true);
		setShowReprocessMenu(false);

		try {
			const result = await reprocessCase(
				caseId,
				selectedReplacementFiles,
				selectedLoanProduct,
				true,
			);
			if (result.new_case_id !== caseId) {
				navigate(`/case/${result.new_case_id}`);
			} else {
				window.location.reload();
			}
		} catch (err) {
			console.error("Reprocess with new files failed:", err);
			alert("Failed to reprocess case with new files");
		} finally {
			setReprocessing(false);
			setSelectedReplacementFiles([]);
		}
	};

	return (
		<nav className="flex items-center border-b border-slate-200 bg-white px-4">
			{!hideTabs && (
				<div className="flex flex-1">
					{tabs.map((tab) =>
						tab.disabled ? (
							// Disabled tab - no navigation, grayed out appearance
							<div key={tab.id} className="results-tab cursor-not-allowed opacity-60">
								{tab.label}
								{tab.count !== undefined && tab.count > 0 && (
									<span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
										{tab.count}
									</span>
								)}
							</div>
						) : tab.locked ? (
							// Locked tab - no navigation, shows "Coming Soon" tooltip
							<div
								key={tab.id}
								className="results-tab locked cursor-not-allowed opacity-60 flex items-center gap-1.5"
								title="Coming Soon"
							>
								<svg
									className="w-3.5 h-3.5 text-slate-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
									/>
								</svg>
								{tab.label}
								<span className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-slate-100 text-slate-500 font-medium">
									Soon
								</span>
							</div>
						) : (
							// Normal tab with navigation
							<NavLink
								key={tab.id}
								to={tab.id === "extraction" ? basePath : `${basePath}/${tab.id}`}
								end={tab.id === "extraction"}
								className={({ isActive }) => `results-tab ${isActive ? "active" : ""}`}
							>
								{tab.label}
								{tab.count !== undefined && tab.count > 0 && (
									<span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
										{tab.count}
									</span>
								)}
							</NavLink>
						),
					)}
				</div>
			)}
			{hideTabs && <div className="flex-1" />}

			{/* Workflow Indicator */}
			{runningWorkflows.length > 0 && (
				<div className="flex items-center gap-2 ml-4 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
					<div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
					<span className="text-sm font-medium text-orange-700">
						{runningWorkflows
							.map((w) => {
								const label =
									w.workflow_type === "extraction"
										? "Extracting"
										: w.workflow_type === "credit"
											? "Verifying Credit"
											: "Verifying Income";
								return label;
							})
							.join(", ")}
					</span>
				</div>
			)}

			{/* Reprocess Button - only when tabs visible; when hideTabs, Reprocess is in Header */}
			{caseId && !hideTabs && (
				<div className="relative ml-4">
					<button
						onClick={() => setShowReprocessMenu(!showReprocessMenu)}
						disabled={reprocessing}
						className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
							reprocessing
								? "bg-slate-100 text-slate-400 cursor-not-allowed"
								: "bg-blue-50 text-blue-700 hover:bg-blue-100"
						}`}
					>
						{reprocessing ? (
							<>
								<svg
									className="w-4 h-4 animate-spin"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
									/>
								</svg>
								Reprocessing...
							</>
						) : (
							<>
								<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
									/>
								</svg>
								Reprocess
								<svg
									className="w-3 h-3 ml-0.5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M19 9l-7 7-7-7"
									/>
								</svg>
							</>
						)}
					</button>

					{/* Dropdown Menu */}
					{showReprocessMenu && (
						<div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
							<button
								onClick={handleReprocessSameFiles}
								className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
							>
								<svg
									className="w-4 h-4 text-slate-500"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
									/>
								</svg>
								<div>
									<div className="font-medium text-slate-700">Same Files</div>
									<div className="text-xs text-slate-500">Re-run extraction on same case</div>
								</div>
							</button>
							<button
								onClick={handleUploadNewFiles}
								className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
							>
								<svg
									className="w-4 h-4 text-slate-500"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
									/>
								</svg>
								<div>
									<div className="font-medium text-slate-700">
										{selectedReplacementFiles.length > 0 ? "Add More Files" : "Upload New Files"}
									</div>
									<div className="text-xs text-slate-500">Pick files from one or more folders</div>
								</div>
							</button>

							{selectedReplacementFiles.length > 0 && (
								<div className="mx-4 my-2 rounded border border-slate-200 bg-slate-50 p-3">
									<p className="text-xs text-slate-600 mb-2">
										{selectedReplacementFiles.length} file
										{selectedReplacementFiles.length > 1 ? "s" : ""} selected
									</p>
									<div className="flex items-center justify-between gap-2">
										<button
											onClick={() => setSelectedReplacementFiles([])}
											className="text-xs text-slate-500 hover:text-slate-700"
										>
											Clear
										</button>
										<button
											onClick={handleReplaceWithSelectedFiles}
											className="px-2.5 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
										>
											Replace Docs
										</button>
									</div>
								</div>
							)}
						</div>
					)}

					{/* Hidden file input */}
					<input
						ref={fileInputRef}
						type="file"
						multiple
						accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp"
						className="hidden"
						onChange={handleFileChange}
					/>
				</div>
			)}
		</nav>
	);
}
