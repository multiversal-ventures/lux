/**
 * AI Review Agent -- full-screen split-pane view.
 *
 * Left:  Full page image (DocumentViewer-style)
 * Right: Scrollable list of review items (AI decisions + manual reviews)
 */

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, CheckCircle2, Eye, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	getAIReviewStatus,
	getPageExtractionStats,
	getPageImageUrl,
	getReviewDecisions,
	reextractBankStatementPages,
	startAIReview,
	submitReviewDecisions,
	triggerReunification,
} from "../../hooks/useApi";
import { subscribeIdTokenChange } from "../../lib/firebase";
import { useReviewAgentStore } from "../../stores/reviewAgentStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewItem {
	file_id: string;
	page_number: number;
	action: string;
	reason: string;
	reviewed_by: string;
	isAI: boolean;
	confidence?: number;
	accepted?: boolean;
}

interface ReextractState {
	state: "running" | "done" | "error";
	message: string;
}

interface PageStats {
	total: number;
	ok: number;
	empty: number;
	low: number;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PageImageViewer({
	caseId,
	selectedPage,
	authToken,
}: {
	caseId: string;
	selectedPage: { file_id: string; page_number: number } | null;
	authToken?: string;
}) {
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		setFailed(false);
	}, [selectedPage?.file_id, selectedPage?.page_number]);

	if (!selectedPage) {
		return (
			<div className="text-center text-slate-400">
				<Eye className="w-12 h-12 mx-auto mb-2 opacity-30" />
				<p className="text-sm">Select a page to preview</p>
			</div>
		);
	}

	if (failed) {
		return (
			<div className="text-center text-slate-400">
				<Eye className="w-12 h-12 mx-auto mb-2 opacity-30" />
				<p className="text-sm">Could not load page image</p>
				<p className="text-xs font-mono mt-1">
					{selectedPage.file_id.slice(-12)} p.{selectedPage.page_number}
				</p>
			</div>
		);
	}

	return (
		<img
			key={`${selectedPage.file_id}_${selectedPage.page_number}`}
			src={getPageImageUrl(caseId, selectedPage.file_id, selectedPage.page_number, authToken)}
			alt={`Page ${selectedPage.page_number}`}
			className="max-h-full max-w-full object-contain rounded shadow-lg"
			onError={() => setFailed(true)}
		/>
	);
}

function StatsBar({ stats, reviewedCount }: { stats: PageStats | null; reviewedCount: number }) {
	if (!stats) return null;
	return (
		<div className="flex items-center gap-4 px-4 py-2 border-b border-slate-100 text-xs text-slate-500 shrink-0">
			<span>{stats.total} pages</span>
			<span className="text-emerald-600">{stats.ok} ok</span>
			<span className="text-red-600">{stats.empty} empty</span>
			<span className="text-indigo-600">{reviewedCount} reviewed</span>
		</div>
	);
}

function ActionBadge({ action }: { action: string }) {
	const cls =
		action === "dismiss"
			? "bg-slate-200 text-slate-600"
			: action === "re_extract" || action === "reextract_requested"
				? "bg-violet-100 text-violet-700"
				: "bg-emerald-100 text-emerald-700";
	return <span className={`px-1.5 py-0.5 text-[10px] rounded ${cls}`}>{action}</span>;
}

function ReextractBanner({ status }: { status: ReextractState }) {
	const cls =
		status.state === "running"
			? "bg-violet-100 text-violet-700"
			: status.state === "done"
				? "bg-emerald-100 text-emerald-700"
				: "bg-red-100 text-red-700";
	return (
		<div className={`mb-1.5 px-2 py-1 rounded text-[11px] flex items-center gap-1.5 ${cls}`}>
			{status.state === "running" && <RefreshCw className="w-3 h-3 animate-spin" />}
			{status.state === "done" && <CheckCircle2 className="w-3 h-3" />}
			{status.message}
		</div>
	);
}

function ReviewItemRow({
	item,
	isSelected,
	rxStatus,
	onSelect,
	onToggleAccept,
	onReextract,
}: {
	item: ReviewItem;
	isSelected: boolean;
	rxStatus?: ReextractState;
	onSelect: () => void;
	onToggleAccept?: () => void;
	onReextract: () => void;
}) {
	const isRunning = rxStatus?.state === "running";
	const bg = isSelected
		? "bg-indigo-50 border-l-2 border-l-indigo-500"
		: rxStatus?.state === "done"
			? "bg-emerald-50 border-l-2 border-l-emerald-500"
			: rxStatus?.state === "running"
				? "bg-violet-50 border-l-2 border-l-violet-400"
				: rxStatus?.state === "error"
					? "bg-red-50 border-l-2 border-l-red-400"
					: "hover:bg-slate-50";

	return (
		<div
			onClick={onSelect}
			className={`cursor-pointer px-4 py-3 border-b border-slate-100 transition-colors ${bg}`}
		>
			{/* Header: file, action, AI badge, confidence */}
			<div className="flex items-center gap-2 mb-1.5">
				<span className="font-mono text-xs text-slate-500">
					...{item.file_id.slice(-8)} p.{item.page_number}
				</span>
				<ActionBadge action={item.action} />
				{item.isAI && <Sparkles className="w-3 h-3 text-indigo-400" />}
				{item.confidence != null && (
					<span className="text-[10px] text-slate-400">{(item.confidence * 100).toFixed(0)}%</span>
				)}
			</div>

			{/* Reason (full text) */}
			<p className="text-sm text-slate-700 mb-1.5 whitespace-pre-wrap">
				{item.reason || "No notes"}
			</p>

			{/* Re-extract status */}
			{rxStatus && <ReextractBanner status={rxStatus} />}

			{/* Actions row */}
			<div className="flex items-center gap-2 flex-wrap">
				<span className="text-[10px] text-slate-400">by {item.reviewed_by}</span>
				{item.isAI && item.accepted !== undefined && onToggleAccept && (
					<button
						onClick={(e) => {
							e.stopPropagation();
							onToggleAccept();
						}}
						className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-colors ${
							item.accepted ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
						}`}
					>
						<Check className="w-2.5 h-2.5" />
						{item.accepted ? "Accept" : "Rejected"}
					</button>
				)}
				<button
					onClick={(e) => {
						e.stopPropagation();
						onReextract();
					}}
					disabled={isRunning}
					className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-colors ${
						rxStatus?.state === "done"
							? "bg-emerald-50 text-emerald-600"
							: "bg-violet-50 text-violet-700 hover:bg-violet-100"
					} disabled:opacity-50`}
				>
					<RefreshCw className={`w-2.5 h-2.5 ${isRunning ? "animate-spin" : ""}`} />
					{rxStatus?.state === "done" ? "Re-extract again" : "Re-extract"}
				</button>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useFirebaseIdToken() {
	const [token, setToken] = useState<string | undefined>();
	useEffect(() => {
		const unsub = subscribeIdTokenChange(async (user) => {
			if (user) setToken(await user.getIdToken());
			else setToken(undefined);
		});
		return () => unsub();
	}, []);
	return token;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface BSReviewAgentModalProps {
	caseId: string;
	dismissedTargets: string[];
}

export function BSReviewAgentModal({ caseId, dismissedTargets }: BSReviewAgentModalProps) {
	const queryClient = useQueryClient();
	const store = useReviewAgentStore();
	const authToken = useFirebaseIdToken();
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const [reviewedPages, setReviewedPages] = useState<ReviewItem[]>([]);
	const [pageStats, setPageStats] = useState<PageStats | null>(null);
	const [selectedPage, setSelectedPage] = useState<{ file_id: string; page_number: number } | null>(
		null,
	);
	const [reextractStatus, setReextractStatus] = useState<Record<string, ReextractState>>({});
	const [reunifying, setReunifying] = useState(false);

	// --- Data loading ---

	const loadReviewContext = useCallback(async () => {
		try {
			const [decisions, stats] = await Promise.all([
				getReviewDecisions(caseId),
				getPageExtractionStats(caseId),
			]);
			setPageStats({
				total: stats.total_pages,
				ok: stats.total_pages - stats.empty_pages - stats.low_pages,
				empty: stats.empty_pages,
				low: stats.low_pages,
			});
			const pages: ReviewItem[] = decisions.decisions
				.filter((d) => d.target_type === "page")
				.map((d) => ({
					file_id: d.target_id.split(":")[0] || "",
					page_number: Number.parseInt(d.target_id.split(":")[1] || "0", 10),
					action: d.action,
					reason: d.reason || "",
					reviewed_by: d.reviewed_by?.split("@")[0] || "unknown",
					isAI: d.reviewed_by === "ai-review-agent",
				}));
			setReviewedPages(pages);
			if (pages.length > 0 && !selectedPage) {
				setSelectedPage({ file_id: pages[0].file_id, page_number: pages[0].page_number });
			}
		} catch {
			/* non-fatal */
		}
	}, [caseId, selectedPage]);

	// --- Workflow lifecycle ---

	const handleStart = useCallback(async () => {
		store.reset();
		store.openModal();
		await loadReviewContext();
		try {
			const resp = await startAIReview(caseId, dismissedTargets);
			store.start(resp.workflow_id);
		} catch (e) {
			store.setError(e instanceof Error ? e.message : "Failed to start AI review");
		}
	}, [caseId, dismissedTargets, store, loadReviewContext]);

	useEffect(() => {
		if (store.status !== "analyzing" || !store.workflowId) return;
		pollRef.current = setInterval(async () => {
			try {
				const resp = await getAIReviewStatus(caseId, store.workflowId!);
				if (resp.status === "complete") {
					store.setDecisions(
						resp.proposed_decisions.map((d) => ({
							file_id: d.file_id,
							page_number: d.page_number,
							action: d.action as "dismiss" | "re_extract",
							reason: d.reason,
							confidence: d.confidence,
							accepted: true,
						})),
					);
					store.complete(resp.summary ?? "");
					loadReviewContext();
					if (pollRef.current) clearInterval(pollRef.current);
				} else if (resp.status === "failed") {
					store.setError(resp.error ?? "Workflow failed");
					if (pollRef.current) clearInterval(pollRef.current);
				}
			} catch {
				/* keep polling */
			}
		}, 3000);
		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, [caseId, store.status, store.workflowId, store, loadReviewContext]);

	// --- Actions ---

	const handleApply = useCallback(async () => {
		const accepted = store.decisions.filter((d) => d.accepted);
		if (!accepted.length) {
			store.closeModal();
			return;
		}
		try {
			await submitReviewDecisions(
				caseId,
				accepted.map((d) => ({
					target_type: "page" as const,
					target_id: `${d.file_id}:${d.page_number}`,
					action: d.action === "dismiss" ? ("dismiss" as const) : ("reextract_requested" as const),
					reason: `[AI] ${d.reason}`,
				})),
			);

			// Trigger reunification to rebuild unified Parquet
			try {
				await triggerReunification(caseId);
			} catch {
				// non-fatal -- unification can be triggered manually
			}

			queryClient.invalidateQueries({ queryKey: ["case", caseId] });
			store.closeModal();
			store.reset();
		} catch (e) {
			store.setError(e instanceof Error ? e.message : "Failed to save");
		}
	}, [caseId, store, queryClient]);

	const handleReextract = useCallback(
		async (fileId: string, pageNumber: number) => {
			const key = `${fileId}_${pageNumber}`;
			setReextractStatus((prev) => ({
				...prev,
				[key]: { state: "running", message: "Starting re-extraction..." },
			}));
			try {
				const resp = await reextractBankStatementPages(caseId, [
					{ file_id: fileId, page_number: pageNumber },
				]);
				setReextractStatus((prev) => ({
					...prev,
					[key]: {
						state: "running",
						message: `Extracting... (workflow: ${resp.workflow_id.slice(-8)})`,
					},
				}));

				// Poll for completion
				const wfId = resp.workflow_id;
				const poll = setInterval(async () => {
					try {
						const status = await getAIReviewStatus(caseId, wfId);
						if (status.status === "complete") {
							clearInterval(poll);
							setReextractStatus((prev) => ({
								...prev,
								[key]: { state: "done", message: status.summary || "Extraction complete" },
							}));
							queryClient.invalidateQueries({ queryKey: ["case", caseId] });
						} else if (status.status === "failed") {
							clearInterval(poll);
							setReextractStatus((prev) => ({
								...prev,
								[key]: { state: "error", message: status.error || "Workflow failed" },
							}));
						}
					} catch {
						/* keep polling */
					}
				}, 3000);

				// Safety timeout: stop polling after 5 minutes
				setTimeout(() => {
					clearInterval(poll);
					setReextractStatus((prev) => {
						const cur = prev[key];
						if (cur?.state === "running") {
							return {
								...prev,
								[key]: { state: "done", message: "Extraction may still be running in background" },
							};
						}
						return prev;
					});
				}, 300000);
			} catch (e) {
				setReextractStatus((prev) => ({
					...prev,
					[key]: { state: "error", message: e instanceof Error ? e.message : "Failed" },
				}));
			}
		},
		[caseId, queryClient],
	);

	// --- Derived state ---

	const acceptedCount = store.decisions.filter((d) => d.accepted).length;
	const dismissCount = store.decisions.filter((d) => d.accepted && d.action === "dismiss").length;
	const reextractCount = store.decisions.filter(
		(d) => d.accepted && d.action === "re_extract",
	).length;
	const isLoading = store.status === "idle" || store.status === "analyzing";

	const allItems: ReviewItem[] = [
		...store.decisions.map((d) => ({
			file_id: d.file_id,
			page_number: d.page_number,
			action: d.action,
			reason: d.reason,
			reviewed_by: "AI Agent",
			isAI: true,
			confidence: d.confidence,
			accepted: d.accepted,
		})),
		...reviewedPages,
	];

	const selKey = selectedPage ? `${selectedPage.file_id}_${selectedPage.page_number}` : null;

	// --- Trigger button (when modal is closed) ---

	if (!store.modalOpen) {
		return (
			<button
				onClick={handleStart}
				className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
			>
				<Sparkles className="w-3.5 h-3.5" />
				Let AI Handle It
			</button>
		);
	}

	// --- Full-screen review page ---

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-white">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
				<div className="flex items-center gap-3">
					<button
						onClick={() => {
							store.closeModal();
							store.reset();
						}}
						className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
					>
						<ArrowLeft className="w-4 h-4" /> Back
					</button>
					<div className="w-px h-5 bg-slate-200" />
					<Sparkles className="w-5 h-5 text-indigo-600" />
					<h2 className="text-base font-semibold text-slate-900">AI Review Agent</h2>
					{isLoading && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
					{store.status === "complete" && store.summary && (
						<span className="text-xs text-slate-500 ml-2 hidden lg:inline">{store.summary}</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					{store.status === "complete" && store.decisions.length > 0 && (
						<>
							<span className="text-xs text-slate-500 hidden sm:inline">
								{acceptedCount} ({dismissCount}D {reextractCount}R)
							</span>
							<button
								onClick={handleApply}
								disabled={acceptedCount === 0}
								className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors"
							>
								<Check className="w-3.5 h-3.5" /> Apply
							</button>
						</>
					)}
					{Object.values(reextractStatus).some(
						(s) => s.state === "done" || s.state === "running",
					) &&
						(() => {
							const anyRunning = Object.values(reextractStatus).some((s) => s.state === "running");
							const doneCount = Object.values(reextractStatus).filter(
								(s) => s.state === "done",
							).length;
							return (
								<button
									onClick={async () => {
										if (anyRunning || reunifying) return;
										setReunifying(true);
										try {
											await triggerReunification(caseId);
											queryClient.invalidateQueries({ queryKey: ["case", caseId] });
											setReunifying(false);
											store.closeModal();
											store.reset();
										} catch {
											setReunifying(false);
										}
									}}
									disabled={anyRunning || reunifying}
									className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
								>
									{reunifying ? (
										<>
											<Loader2 className="w-3.5 h-3.5 animate-spin" /> Unifying...
										</>
									) : anyRunning ? (
										<>
											<Loader2 className="w-3.5 h-3.5 animate-spin" /> Extracting...
										</>
									) : (
										<>
											<RefreshCw className="w-3.5 h-3.5" /> Reunify &amp; Close ({doneCount})
										</>
									)}
								</button>
							);
						})()}
					{!isLoading &&
						store.decisions.length === 0 &&
						!Object.values(reextractStatus).some((s) => s.state === "done") && (
							<button
								onClick={() => {
									store.closeModal();
									store.reset();
								}}
								className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
							>
								Done
							</button>
						)}
				</div>
			</div>

			{/* Split pane */}
			<div className="flex-1 flex min-h-0">
				{/* Left: page image */}
				<div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center p-4">
					<PageImageViewer caseId={caseId} selectedPage={selectedPage} authToken={authToken} />
				</div>

				{/* Right: review list */}
				<div className="w-[400px] border-l border-slate-200 flex flex-col bg-white shrink-0">
					<StatsBar stats={pageStats} reviewedCount={allItems.length} />

					<div className="flex-1 overflow-y-auto">
						{isLoading && allItems.length === 0 && (
							<div className="flex flex-col items-center justify-center py-16 gap-2">
								<Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
								<p className="text-xs text-slate-500">Analyzing pages...</p>
							</div>
						)}
						{store.status === "error" && (
							<div className="m-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
								{store.error}
							</div>
						)}
						{allItems.length === 0 && store.status === "complete" && (
							<div className="flex flex-col items-center justify-center py-16 gap-2">
								<CheckCircle2 className="w-8 h-8 text-emerald-400" />
								<p className="text-sm text-slate-600">No pages to review</p>
							</div>
						)}
						{allItems.map((item, i) => {
							const key = `${item.file_id}_${item.page_number}`;
							return (
								<ReviewItemRow
									key={`${key}_${i}`}
									item={item}
									isSelected={selKey === key}
									rxStatus={reextractStatus[key]}
									onSelect={() =>
										setSelectedPage({ file_id: item.file_id, page_number: item.page_number })
									}
									onToggleAccept={
										item.isAI
											? () => store.toggleDecision(item.file_id, item.page_number)
											: undefined
									}
									onReextract={() => handleReextract(item.file_id, item.page_number)}
								/>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
