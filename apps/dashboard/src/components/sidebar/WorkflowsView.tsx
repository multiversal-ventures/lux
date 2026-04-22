import { memo, useMemo, useEffect, useState, useRef } from "react";
import { AlertCircle, AlertTriangle, FileUp, BookOpen, FileCheck, Sparkles } from "lucide-react";
import type { CaseStatus, CaseProgress, StreamEvent } from "../../types";
import {
	PHASES as ALL_PHASES,
	PHASE_PRIORITY,
	normalizeStatus,
	type PhaseConfig,
} from "../../lib/phases";

type PhaseDefinition = PhaseConfig;

// ─── ETA Data ─────────────────────────────────────────────────────────────────

interface ETAData {
	eta_seconds?: number;
	progress_pct?: number;
	pages_processed?: number;
	pages_completed?: number;
	total_pages?: number;
	batch_number?: number;
	total_batches?: number;
	elapsed_seconds?: number;
	started_at?: string; // ISO timestamp for calculating elapsed time on refresh
	// Parsing phase fields
	files_parsed?: number;
	total_files?: number;
	// Validation phase fields
	validated_doc_types?: number;
	total_doc_types?: number;
	rules_checked?: number;
	rules_passed?: number;
	// Case size and ETA confidence (EMA-based estimation)
	case_size?: "quick" | "standard" | "large";
	eta_confidence?: "estimating" | "warming_up" | "calculating" | "accurate";
	is_large_case?: boolean;
	// ETA range for large cases
	eta_range_low?: number;
	eta_range_high?: number;
	// Queue position (when multiple jobs are running)
	queue_position?: number;
	total_running?: number;
	est_wait_seconds?: number;
	is_processing?: boolean;
}

// Stepper-visible phases — derived from the canonical PHASES in lib/phases.ts.
// Excludes 'failed' because the stepper shows failure as a banner, not a step.
const EXTRACTION_PHASES: PhaseDefinition[] = ALL_PHASES.filter((p) => p.code !== "failed");

// ─── Types ────────────────────────────────────────────────────────────────────

type PhaseState = "completed" | "active" | "pending" | "failed" | "review_required" | "warning";

interface WorkflowsViewProps {
	/** Current case status */
	currentStatus: CaseStatus | null;
	/** Callback to refetch case data (polling fallback) */
	refetch?: () => void;
	/** Real-time events for ETA display */
	events?: StreamEvent[];
	/** Document types found so far (for conditional step display) */
	foundDocumentTypes?: string[];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const WorkflowsView = memo(function WorkflowsView({
	currentStatus,
	refetch: _refetch, // Unused - polling removed, SSE handles updates
	events = [],
	foundDocumentTypes = [],
}: WorkflowsViewProps) {
	const isUnknownStatus = currentStatus == null || (currentStatus as any)?.status == null;

	// PHASE_PRIORITY imported from lib/phases.ts
	const highWaterRef = useRef<{ code: string; priority: number } | null>(null);

	// Advance the high-water mark from SSE events. Each event now carries
	// `data.status` set by the backend, which arrives faster than polling.
	useEffect(() => {
		if (events.length === 0) return;
		for (const evt of events) {
			const sseStatus = evt.data?.status as string | undefined;
			if (!sseStatus) continue;
			const prio = PHASE_PRIORITY[sseStatus] ?? 0;
			if (prio > 0 && (!highWaterRef.current || prio > highWaterRef.current.priority)) {
				highWaterRef.current = { code: sseStatus, priority: prio };
			}
		}
	}, [events]);

	// Reconcile polled status with the high-water mark.
	const rawStatusCode = currentStatus?.status?.code as string | undefined;
	let effectiveStatus = currentStatus;
	if (rawStatusCode) {
		const normalizedCode = normalizeStatus(rawStatusCode);
		const prio = PHASE_PRIORITY[normalizedCode] ?? 0;
		if (!highWaterRef.current || prio >= highWaterRef.current.priority) {
			highWaterRef.current = { code: normalizedCode, priority: prio };
		} else {
			effectiveStatus = {
				...currentStatus!,
				status: { ...currentStatus!.status, code: highWaterRef.current.code },
			} as CaseStatus;
		}
	} else if (highWaterRef.current) {
		// Polling returned nothing yet but SSE already told us the real status
		effectiveStatus = {
			status: { code: highWaterRef.current.code, title: highWaterRef.current.code },
		} as unknown as CaseStatus;
	}

	// Extract latest ETA data from events - look for ANY progress-related data
	// Falls back to currentStatus for started_at (persists elapsed time across refresh)
	const etaData = useMemo<ETAData | null>(() => {
		// Find the most recent event with any progress data
		for (let i = events.length - 1; i >= 0; i--) {
			const event = events[i];
			const data = event.data as ETAData | undefined;
			if (
				data &&
				(data.eta_seconds !== undefined ||
					data.eta_range_low !== undefined ||
					data.eta_confidence !== undefined ||
					data.progress_pct !== undefined ||
					data.pages_processed !== undefined ||
					data.pages_completed !== undefined ||
					data.elapsed_seconds !== undefined ||
					data.batch_number !== undefined ||
					data.files_parsed !== undefined ||
					data.validated_doc_types !== undefined)
			) {
				// Merge with started_at from currentStatus for elapsed time persistence
				return {
					...data,
					started_at: data.started_at ?? (currentStatus as any)?.started_at,
				};
			}
		}
		// Fallback to currentStatus for initial load (before SSE events)
		if (currentStatus) {
			const status = currentStatus as any;
			if (status.progress_pct !== undefined || status.started_at) {
				return {
					progress_pct: status.progress_pct,
					elapsed_seconds: status.elapsed_seconds,
					started_at: status.started_at,
					eta_seconds: status.eta_seconds,
					eta_range_low: status.eta_range_low,
					eta_range_high: status.eta_range_high,
					eta_confidence: status.eta_confidence,
					eta_scope: status.eta_scope,
					eta_segment: status.eta_segment,
				};
			}
		}
		return null;
	}, [events, currentStatus]);

	// Extract progress stats from SSE events for real-time StatBox updates
	const sseProgress = useMemo<Partial<CaseProgress> | null>(() => {
		if (!events || events.length === 0) return null;

		// Find latest event with progress fields (documents_found, pages_total, facts_extracted)
		for (let i = events.length - 1; i >= 0; i--) {
			const data = events[i].data as Record<string, unknown> | undefined;
			if (
				data &&
				(data.documents_found !== undefined ||
					data.pages_total !== undefined ||
					data.facts_extracted !== undefined)
			) {
				return {
					documents_found: (data.documents_found as number) ?? 0,
					pages_total: (data.pages_total as number) ?? 0,
					facts_extracted: (data.facts_extracted as number) ?? 0,
					files_uploaded: (data.files_total as number) ?? 0,
				};
			}
		}
		return null;
	}, [events]);

	// Merge: SSE progress takes precedence over polled status for real-time updates
	const mergedProgress: CaseProgress = useMemo(() => {
		const polled = currentStatus?.progress ?? {
			files_uploaded: 0,
			documents_found: 0,
			pages_processed: 0,
			pages_total: 0,
			facts_extracted: 0,
			percent: 0,
		};

		if (!sseProgress) return polled;

		return {
			...polled,
			documents_found: sseProgress.documents_found ?? polled.documents_found,
			pages_total: sseProgress.pages_total ?? polled.pages_total,
			facts_extracted: sseProgress.facts_extracted ?? polled.facts_extracted,
			files_uploaded: sseProgress.files_uploaded ?? polled.files_uploaded,
		};
	}, [currentStatus?.progress, sseProgress]);

	// Detect review blockers and warnings from SSE complete event
	const reviewBlockerCount = useMemo(() => {
		for (let i = events.length - 1; i >= 0; i--) {
			const event = events[i];
			if (event.type === "complete") {
				const data = event.data as Record<string, unknown> | undefined;
				return (data?.review_blocker_count as number) ?? 0;
			}
		}
		return 0;
	}, [events]);

	const reviewWarningCount = useMemo(() => {
		for (let i = events.length - 1; i >= 0; i--) {
			const event = events[i];
			if (event.type === "complete") {
				const data = event.data as Record<string, unknown> | undefined;
				return (data?.review_warning_count as number) ?? 0;
			}
		}
		return 0;
	}, [events]);

	// Detect bank-statement presence from found document types or SSE events
	// so the unification step can dynamically appear.
	const hasBankStatements = useMemo(() => {
		if (foundDocumentTypes.some((t) => t.toLowerCase().includes("bankstatement"))) return true;
		for (let i = events.length - 1; i >= 0; i--) {
			const data = events[i].data as Record<string, unknown> | undefined;
			if (!data) continue;
			const docClass = data.document_class as string | undefined;
			if (docClass?.toLowerCase().includes("bankstatement")) return true;
			const docTypes = data.document_types as string[] | undefined;
			if (docTypes?.some((t) => t.toLowerCase().includes("bankstatement"))) return true;
		}
		return false;
	}, [events, foundDocumentTypes]);

	const extractionPhaseStates = useMemo(() => {
		let rawCode = effectiveStatus?.status.code as string | undefined;
		if (rawCode === "started" || rawCode === "preparing") rawCode = "loading";

		const currentCode = rawCode;
		const isFailed = currentCode === "failed";

		const failedPhase = isFailed
			? ((effectiveStatus as any)?.status?.failed_phase ?? "loading")
			: null;
		const failedIndex = failedPhase
			? EXTRACTION_PHASES.findIndex((p) => p.code === failedPhase)
			: -1;

		const currentIndex = isFailed
			? failedIndex
			: currentCode
				? EXTRACTION_PHASES.findIndex((p) => p.code === currentCode)
				: -1;

		const result = EXTRACTION_PHASES.map((phase, index) => {
			// Optional phases only appear when contextually relevant — never
			// just because a higher-priority phase was reached (e.g. don't show
			// "Analyzing Bank Statements" when no bank statements were found).
			if (phase.optional) {
				const show =
					(phase.code === "unification" && hasBankStatements) || currentCode === phase.code;
				if (!show) {
					return { ...phase, state: "skipped" as const };
				}
			}

			if (isFailed) {
				if (index < currentIndex) {
					return { ...phase, state: "completed" as PhaseState };
				}
				if (index === currentIndex) {
					return { ...phase, state: "failed" as PhaseState };
				}
				return { ...phase, state: "pending" as PhaseState };
			}

			if (index < currentIndex) {
				return { ...phase, state: "completed" as PhaseState };
			}

			if (index === currentIndex) {
				if (currentCode === "completed") {
					if (reviewBlockerCount > 0) {
						return { ...phase, state: "review_required" as PhaseState };
					}
					if (reviewWarningCount > 0) {
						return { ...phase, state: "warning" as PhaseState };
					}
					return { ...phase, state: "completed" as PhaseState };
				}
				return { ...phase, state: "active" as PhaseState };
			}

			return { ...phase, state: "pending" as PhaseState };
		}).filter((p) => p.state !== "skipped");

		return result;
	}, [effectiveStatus, reviewBlockerCount, reviewWarningCount, hasBankStatements]);

	// Track the completion transition so the cascade animation only plays once.
	const allDone = extractionPhaseStates.every(
		(p) => p.state === "completed" || p.state === "warning" || p.state === "review_required",
	);
	const wasAllDone = useRef(false);
	const [justCompleted, setJustCompleted] = useState(false);

	useEffect(() => {
		if (allDone && !wasAllDone.current) {
			wasAllDone.current = true;
			setJustCompleted(true);
			const timer = setTimeout(() => setJustCompleted(false), 2000);
			return () => clearTimeout(timer);
		}
		if (!allDone) {
			wasAllDone.current = false;
		}
	}, [allDone]);

	// Track which phase codes were visible last render so new ones animate in.
	// Skip the initial render so all steps don't plop in on mount.
	const prevCodesRef = useRef<Set<string> | null>(null);
	const [newCodes, setNewCodes] = useState(new Set<string>());

	useEffect(() => {
		const currentCodes = new Set(extractionPhaseStates.map((p) => p.code));
		if (prevCodesRef.current === null) {
			prevCodesRef.current = currentCodes;
			return;
		}
		const freshCodes = new Set<string>();
		currentCodes.forEach((c) => {
			if (!prevCodesRef.current!.has(c)) freshCodes.add(c);
		});
		prevCodesRef.current = currentCodes;
		if (freshCodes.size > 0) {
			setNewCodes(freshCodes);
			const timer = setTimeout(() => setNewCodes(new Set()), 800);
			return () => clearTimeout(timer);
		}
	}, [extractionPhaseStates]);

	return (
		<div
			className={`rounded-xl py-8 px-12 mb-4 ${
				isUnknownStatus ? "bg-slate-50 border border-slate-200" : "bg-white"
			}`}
		>
			<div className="flex flex-col">
				{extractionPhaseStates.map((phase, index) => (
					<TaskItem
						key={phase.code}
						label={phase.label}
						state={phase.state}
						isLast={index === extractionPhaseStates.length - 1}
						isUnknown={isUnknownStatus}
						index={index}
						allCompleted={justCompleted}
						isNew={newCodes.has(phase.code)}
					/>
				))}
			</div>
			<ProgressIndicator progress={mergedProgress} isUnknown={isUnknownStatus} />
			{etaData && currentStatus?.status.code !== "completed" && <ETAIndicator etaData={etaData} />}
		</div>
	);
});

// ─── TaskItem Component ───────────────────────────────────────────────────────

interface TaskItemProps {
	label: string;
	state: PhaseState;
	isLast: boolean;
	isUnknown: boolean;
	index: number;
	allCompleted: boolean;
	isNew?: boolean;
}

function TaskItem({ label, state, isLast, isUnknown, index, allCompleted, isNew }: TaskItemProps) {
	const staggerDelay = allCompleted ? `${index * 80}ms` : "0ms";

	return (
		<div
			className={`flex items-start gap-4${isNew ? " overflow-hidden" : ""}`}
			style={{
				animation: isNew
					? "stepPlopIn 450ms cubic-bezier(0.34,1.56,0.64,1) both"
					: allCompleted
						? `fadeInStep 400ms ease-out ${staggerDelay} both`
						: undefined,
			}}
		>
			{/* Stepper column: icon + line */}
			<div className="flex flex-col items-center">
				<StepIcon
					state={state}
					isUnknown={isUnknown}
					isLast={isLast}
					allCompleted={allCompleted}
					staggerDelay={staggerDelay}
				/>
				{!isLast && (
					<div
						className={`w-0.5 flex-1 min-h-4 transition-colors duration-300 ${
							isUnknown
								? "bg-slate-200"
								: state === "completed"
									? "bg-slate-300"
									: state === "warning"
										? "bg-amber-200"
										: state === "failed" || state === "review_required"
											? "bg-red-200"
											: "bg-slate-200"
						}`}
					/>
				)}
			</div>
			{/* Label */}
			<div className="flex flex-col">
				<span
					className={`text-[16px] leading-5 transition-colors duration-300 ${
						isUnknown
							? "text-slate-400"
							: state === "completed"
								? "text-slate-600"
								: state === "active"
									? "text-slate-700 font-medium"
									: state === "failed"
										? "text-red-600 font-medium"
										: state === "review_required"
											? "text-rose-600 font-medium"
											: state === "warning"
												? "text-amber-700 font-medium"
												: "text-slate-400"
					}`}
				>
					{state === "review_required"
						? "Review Required"
						: state === "warning"
							? "Completed with warnings"
							: label}
				</span>
				{state === "failed" && (
					<span className="text-[13px] text-red-500 mt-0.5">Failed. Try again later.</span>
				)}
				{state === "review_required" && (
					<span className="text-[13px] text-rose-500 mt-0.5">
						Missing documents — see Review page
					</span>
				)}
				{state === "warning" && (
					<span className="text-[13px] text-amber-600 mt-0.5">See Review page for details</span>
				)}
			</div>
		</div>
	);
}

// ─── StepIcon Component ───────────────────────────────────────────────────────

interface StepIconProps {
	state: PhaseState;
	isUnknown: boolean;
	isLast?: boolean;
	allCompleted?: boolean;
	staggerDelay?: string;
}

function StepIcon({ state, isUnknown, isLast, allCompleted, staggerDelay }: StepIconProps) {
	if (isUnknown) {
		return (
			<div className="w-5 h-5 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
				<svg className="w-3.5 h-3.5 text-slate-400 animate-spin" viewBox="0 0 24 24" fill="none">
					<circle
						className="opacity-25"
						cx="12"
						cy="12"
						r="9"
						stroke="currentColor"
						strokeWidth="3"
					/>
					<path
						className="opacity-75"
						fill="currentColor"
						d="M21 12a9 9 0 00-9-9v3a6 6 0 016 6h3z"
					/>
				</svg>
			</div>
		);
	}

	if (state === "completed") {
		const isFinalStep = isLast && allCompleted;
		return (
			<div
				className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0${isFinalStep ? " ring-2 ring-green-200 ring-offset-1" : ""}`}
				style={{
					backgroundColor: "#4caf50",
					animation: isFinalStep
						? `popIn 500ms cubic-bezier(0.34,1.56,0.64,1) ${staggerDelay} both`
						: undefined,
				}}
			>
				<svg
					className="w-3 h-3 text-white"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={3}
					style={{
						animation: isFinalStep ? `drawCheck 400ms ease-out ${staggerDelay} both` : undefined,
					}}
				>
					<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
				</svg>
			</div>
		);
	}

	if (state === "active") {
		return (
			<div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 animate-pulse">
				<svg className="w-2 h-2 text-white ml-0.5" viewBox="0 0 12 14" fill="currentColor">
					<path
						d="M2 2 L2 12 L10 7 Z"
						strokeLinejoin="round"
						strokeLinecap="round"
						stroke="currentColor"
						strokeWidth="3.5"
					/>
				</svg>
			</div>
		);
	}

	if (state === "review_required") {
		return <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />;
	}

	if (state === "warning") {
		return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
	}

	if (state === "failed") {
		return (
			<div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
				<svg
					className="w-3 h-3 text-white"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={3}
				>
					<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</div>
		);
	}

	return <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0" />;
}

// ─── ProgressIndicator Component ─────────────────────────────────────────────

interface ProgressIndicatorProps {
	progress: CaseProgress;
	isUnknown: boolean;
}

function ProgressIndicator({ progress, isUnknown }: ProgressIndicatorProps) {
	return (
		<div className="mt-6 pt-5 border-t border-slate-100">
			<div className="grid grid-cols-4 gap-2.5">
				<StatBox
					label="Files"
					value={progress.files_uploaded}
					isUnknown={isUnknown}
					icon={<FileUp className="w-3.5 h-3.5" />}
				/>
				<StatBox
					label="Pages"
					value={progress.pages_total}
					isUnknown={isUnknown}
					icon={<BookOpen className="w-3.5 h-3.5" />}
				/>
				<StatBox
					label="Docs"
					value={progress.documents_found}
					isUnknown={isUnknown}
					icon={<FileCheck className="w-3.5 h-3.5" />}
				/>
				<StatBox
					label="Facts"
					value={progress.facts_extracted}
					isUnknown={isUnknown}
					icon={<Sparkles className="w-3.5 h-3.5" />}
				/>
			</div>
		</div>
	);
}

function StatBox({
	label,
	value,
	isUnknown,
	icon,
}: {
	label: string;
	value: string | number;
	isUnknown: boolean;
	icon: React.ReactNode;
}) {
	const hasValue = Number(value) > 0;
	return (
		<div
			className={`rounded-lg px-3 py-2.5 border transition-colors ${
				isUnknown
					? "bg-slate-50/70 border-slate-200"
					: hasValue
						? "bg-white border-slate-200 shadow-sm"
						: "bg-slate-50/70 border-slate-200"
			}`}
		>
			<div
				className={`flex items-center gap-1.5 mb-1 ${isUnknown ? "text-slate-300" : hasValue ? "text-slate-500" : "text-slate-300"}`}
			>
				{icon}
				<span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
			</div>
			<div
				className={`text-lg font-semibold tabular-nums ${isUnknown ? "text-slate-300" : hasValue ? "text-slate-800" : "text-slate-300"}`}
			>
				{hasValue ? value : "\u2014"}
			</div>
		</div>
	);
}

// ─── ETAIndicator Component ───────────────────────────────────────────────────

interface ETAIndicatorProps {
	etaData: ETAData;
}

function formatTime(seconds: number): string {
	if (seconds < 60) {
		return `${Math.round(seconds)}s`;
	}
	const mins = Math.floor(seconds / 60);
	const secs = Math.round(seconds % 60);
	if (mins < 60) {
		return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
	}
	const hours = Math.floor(mins / 60);
	const remainingMins = mins % 60;
	return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

function ETAIndicator({ etaData }: ETAIndicatorProps) {
	const {
		eta_seconds,
		progress_pct,
		elapsed_seconds,
		started_at,
		pages_processed,
		total_pages,
		batch_number,
		total_batches,
		files_parsed,
		total_files,
		validated_doc_types,
		total_doc_types,
		case_size,
		eta_confidence,
		is_large_case,
		eta_range_low,
		eta_range_high,
		queue_position,
		total_running,
		est_wait_seconds,
		is_processing,
	} = etaData;

	// Determine if this is a large case (for range display)
	const isLargeCase = case_size === "large" || is_large_case;

	// Determine if we're queued (not actively processing, position > 1)
	const isQueued = queue_position !== undefined && queue_position > 1 && !is_processing;

	// Show complexity note on hover
	const [showComplexityNote, setShowComplexityNote] = useState(false);

	// Calculate initial elapsed from started_at (persists across refresh)
	const calculateElapsedFromStart = (): number => {
		if (started_at) {
			const startTime = new Date(started_at).getTime();
			const now = Date.now();
			return Math.max(0, Math.floor((now - startTime) / 1000));
		}
		return elapsed_seconds ?? 0;
	};

	// Live elapsed time counter - initialized from started_at for persistence
	const [liveElapsed, setLiveElapsed] = useState(calculateElapsedFromStart);
	const maxElapsedSeen = useRef(calculateElapsedFromStart());

	// Update live elapsed when started_at changes (e.g., on first load)
	useEffect(() => {
		const calculatedElapsed = calculateElapsedFromStart();
		if (calculatedElapsed > maxElapsedSeen.current) {
			maxElapsedSeen.current = calculatedElapsed;
			setLiveElapsed(calculatedElapsed);
		}
	}, [started_at, elapsed_seconds]);

	// Tick up elapsed time every second for smooth counting
	useEffect(() => {
		const interval = setInterval(() => {
			setLiveElapsed((prev: number) => {
				const next = prev + 1;
				// Update max seen as we tick
				if (next > maxElapsedSeen.current) {
					maxElapsedSeen.current = next;
				}
				return next;
			});
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	// Track maximum progress seen to prevent regression
	const maxProgressSeen = useRef(0);

	// Calculate progress percentage from available data
	let calculatedProgress = progress_pct;
	if (calculatedProgress === undefined) {
		if (pages_processed !== undefined && total_pages !== undefined && total_pages > 0) {
			calculatedProgress = (pages_processed / total_pages) * 100;
		} else if (batch_number !== undefined && total_batches !== undefined && total_batches > 0) {
			calculatedProgress = (batch_number / total_batches) * 100;
		} else if (files_parsed !== undefined && total_files !== undefined && total_files > 0) {
			calculatedProgress = (files_parsed / total_files) * 100;
		} else if (
			validated_doc_types !== undefined &&
			total_doc_types !== undefined &&
			total_doc_types > 0
		) {
			calculatedProgress = (validated_doc_types / total_doc_types) * 100;
		}
	}

	// Ensure progress only goes up, never down (cap at 99% until truly complete)
	if (calculatedProgress !== undefined) {
		if (calculatedProgress > maxProgressSeen.current) {
			maxProgressSeen.current = calculatedProgress;
		} else {
			calculatedProgress = maxProgressSeen.current;
		}
		// Cap at 99% - the stepper shows completion state
		calculatedProgress = Math.min(calculatedProgress, 99);
	}

	// Build progress text from available data
	let progressText = "";
	if (pages_processed !== undefined && total_pages !== undefined && total_pages > 0) {
		progressText = `${pages_processed}/${total_pages} pages`;
	} else if (batch_number !== undefined && total_batches !== undefined) {
		progressText = `batch ${batch_number}/${total_batches}`;
	} else if (files_parsed !== undefined && total_files !== undefined) {
		progressText = `${files_parsed}/${total_files} files`;
	} else if (validated_doc_types !== undefined && total_doc_types !== undefined) {
		progressText = `${validated_doc_types}/${total_doc_types} doc types`;
	}

	// Don't show if no useful data at all
	const hasAnyData =
		calculatedProgress !== undefined ||
		elapsed_seconds !== undefined ||
		eta_seconds !== undefined ||
		progressText;
	if (!hasAnyData) {
		return null;
	}

	const formatRange = (low?: number, high?: number) => {
		if (!low || !high) return null;
		if (low < 60 && high < 60) {
			return `${Math.round(low)}–${Math.round(high)}s`;
		}
		const lowMin = Math.ceil(low / 60);
		const highMin = Math.ceil(high / 60);
		if (lowMin === highMin) return `${lowMin}m`;
		return `${lowMin}–${highMin}m`;
	};

	// Get tooltip text based on confidence
	const getTooltipText = () => {
		if (isQueued) {
			return `Position ${queue_position} of ${total_running} in queue. Your job will start when current jobs complete.`;
		}
		if (eta_confidence === "estimating") {
			return "Initial estimate based on page count. Will refine as we process.";
		}
		if (eta_confidence === "warming_up") {
			return "ETA is calibrating based on your document complexity.";
		}
		if (eta_confidence === "calculating") {
			return "ETA is refining based on actual processing speed.";
		}
		if (eta_confidence === "accurate") {
			return "ETA is based on actual processing speed of your documents.";
		}
		if (isLargeCase) {
			return "Large case - ETA uses adaptive estimation.";
		}
		if (total_running && total_running > 1) {
			return `${total_running} jobs running - ETA may vary due to load.`;
		}
		return "ETA depends on upload complexity and may change as we process.";
	};

	return (
		<div className="mt-4 pt-4 border-t border-slate-100">
			{/* Queue position indicator when not first in queue */}
			{isQueued && (
				<div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
					<div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
					<span className="text-xs font-medium text-amber-800">
						Position {queue_position} of {total_running} in queue
					</span>
					{est_wait_seconds && est_wait_seconds > 0 && (
						<span className="text-xs text-amber-600 ml-auto">
							~{formatTime(est_wait_seconds)} wait
						</span>
					)}
				</div>
			)}

			<div className="flex items-center justify-between text-xs text-slate-500">
				{/* Left side: ETA with confidence indicator */}
				<span
					className="flex items-center gap-1.5 cursor-help relative"
					onMouseEnter={() => setShowComplexityNote(true)}
					onMouseLeave={() => setShowComplexityNote(false)}
				>
					{(() => {
						const hasRangeEstimate =
							eta_range_low != null &&
							eta_range_high != null &&
							eta_range_low > 0 &&
							eta_range_high > 0;

						const hasPointEstimate =
							eta_seconds !== undefined &&
							eta_seconds > 0 &&
							(eta_confidence === "calculating" || eta_confidence === "accurate");

						const etaIsStale =
							hasPointEstimate &&
							liveElapsed > 60 &&
							eta_seconds !== undefined &&
							eta_seconds < liveElapsed * 0.2;

						const isAlmostDone = progress_pct !== undefined && progress_pct >= 96;

						let etaNode: React.ReactNode = null;

						if (isQueued) {
							etaNode = (
								<span className="text-amber-600">
									~{formatTime((eta_seconds ?? 0) + (est_wait_seconds ?? 0))} total
									<span className="text-amber-500 ml-1">(includes wait)</span>
								</span>
							);
						} else if (isAlmostDone) {
							etaNode = <span className="text-emerald-600 font-medium">finishing up…</span>;
						} else if (etaIsStale) {
							etaNode = <span className="text-emerald-600 font-medium">almost there…</span>;
						} else if (hasRangeEstimate) {
							etaNode = (
								<span className="text-slate-500">
									~{formatRange(eta_range_low, eta_range_high)} remaining
								</span>
							);
						} else if (hasPointEstimate) {
							etaNode = (
								<span className="text-slate-500">~{formatTime(eta_seconds!)} remaining</span>
							);
						}

						if (!etaNode) return null;

						return (
							<>
								{etaNode}
								<svg
									className="w-3 h-3 text-slate-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<circle cx="12" cy="12" r="10" />
									<path d="M12 16v-4M12 8h.01" />
								</svg>
								{showComplexityNote && (
									<div className="absolute left-0 bottom-full mb-2 w-52 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg z-10">
										<div className="font-medium mb-1">{getTooltipText()}</div>
									</div>
								)}
							</>
						);
					})()}
				</span>

				{/* Center: progress */}
				{progressText && <span className="text-slate-500 font-medium">{progressText}</span>}

				{/* Right: elapsed wall time */}
				<span className="flex items-center gap-1 text-slate-400 tabular-nums" title="Elapsed time">
					<svg
						className="w-3 h-3 shrink-0"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<circle cx="12" cy="12" r="10" />
						<path d="M12 6v6l4 2" />
					</svg>
					{formatTime(liveElapsed)}
				</span>
			</div>

			{/* Progress bar - pulse only when truly estimating (no ETA data) */}
			{calculatedProgress !== undefined && (
				<div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
					{eta_seconds === undefined &&
					(eta_range_low === undefined || eta_range_high === undefined) ? (
						<div
							className="h-full bg-orange-400 rounded-full animate-pulse"
							style={{ width: "100%", opacity: 0.6 }}
						/>
					) : (
						<div
							className="h-full bg-orange-400 rounded-full transition-all duration-500 ease-out"
							style={{ width: `${Math.min(100, Math.max(0, calculatedProgress))}%` }}
						/>
					)}
				</div>
			)}
		</div>
	);
}

export default WorkflowsView;
