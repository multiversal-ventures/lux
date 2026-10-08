import type {
	DecisionDraftResponse,
	DecisionHistoryResponse,
	PublishDecisionRequest,
} from "@multiversal-ventures/lux-core";
import { getDefaultClient } from "@multiversal-ventures/lux-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LoanStatusBadge } from "../LoanStatus/LoanStatusBadge.js";

export interface LoanDecisionPanelProps {
	caseId: string;
}

type DecisionCondition = NonNullable<PublishDecisionRequest["conditions"]>[number];

const draftKey = (caseId: string) => ["decision-draft", caseId];
const historyKey = (caseId: string) => ["decisions", caseId];

/**
 * The officer's publish action. Nothing reaches the borrower without this
 * click: the engine suggests an outcome and prefills the numbers, and the
 * lender owns the decision.
 *
 * Terms are READ-ONLY on purpose. Every published number traces to one
 * calculation, so changing the terms means running a refinement first — the
 * draft then picks up the newer result. Typing a number here would break that
 * chain.
 *
 * The decision is case-level, so every party's detail shows the same panel.
 */
export function LoanDecisionPanel({ caseId }: LoanDecisionPanelProps) {
	const [open, setOpen] = useState(false);
	const client = getDefaultClient();

	const draft = useQuery<DecisionDraftResponse, Error>({
		queryKey: draftKey(caseId),
		queryFn: () => client.getDecisionDraft(caseId),
	});
	const history = useQuery<DecisionHistoryResponse, Error>({
		queryKey: historyKey(caseId),
		queryFn: () => client.listDecisions(caseId),
	});

	// `current_status` is null for a case with no portal party — on both
	// responses — so the panel renders with no badge rather than crashing.
	const status = draft.data?.current_status ?? history.data?.current_status ?? null;
	const decisions = history.data?.decisions ?? [];

	return (
		<div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
			<div className="flex items-center justify-between gap-3 flex-wrap">
				<div className="flex items-center gap-2 flex-wrap">
					<span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
						Borrower sees
					</span>
					{status ? (
						<LoanStatusBadge status={status} />
					) : (
						<span className="text-sm text-slate-400">
							{draft.isLoading ? "…" : "No borrower status yet"}
						</span>
					)}
				</div>
				<button
					type="button"
					onClick={() => setOpen(true)}
					className="text-sm font-medium text-blue-700 hover:text-blue-900 cursor-pointer transition-colors"
				>
					Update borrower status
				</button>
			</div>

			{decisions.length > 0 ? (
				<ul className="mt-2 space-y-0.5">
					{decisions.slice(0, 3).map((decision) => (
						<li
							key={decision.decision_id}
							data-testid="decision-history-entry"
							className="text-xs text-slate-500"
						>
							{/* One line, one element: kind, who, when. */}
							{decision.label} · {decision.decided_by_name || "—"} ·{" "}
							{formatDateTime(decision.created_at)}
						</li>
					))}
				</ul>
			) : null}

			{open && draft.data ? (
				<DecisionModal caseId={caseId} draft={draft.data} onClose={() => setOpen(false)} />
			) : null}
		</div>
	);
}

function DecisionModal({
	caseId,
	draft,
	onClose,
}: {
	caseId: string;
	draft: DecisionDraftResponse;
	onClose: () => void;
}) {
	const qc = useQueryClient();
	const client = getDefaultClient();
	const kinds = draft.kinds ?? [];
	const [kind, setKind] = useState<string>(draft.suggested_kind ?? kinds[0]?.key ?? "");
	// The draft's suggestions start checked; the officer decides what ships.
	const [conditions, setConditions] = useState<DecisionCondition[]>(draft.conditions ?? []);
	const [checked, setChecked] = useState<Set<number>>(
		new Set((draft.conditions ?? []).map((_, index) => index)),
	);
	const [title, setTitle] = useState("");
	const [detail, setDetail] = useState("");
	const [message, setMessage] = useState("");

	// A refinement can land while the modal is open; follow the newer draft.
	useEffect(() => {
		if (draft.suggested_kind) setKind(draft.suggested_kind);
	}, [draft.suggested_kind]);

	const publish = useMutation({
		mutationFn: (body: PublishDecisionRequest) => client.publishDecision(caseId, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: draftKey(caseId) });
			qc.invalidateQueries({ queryKey: historyKey(caseId) });
			onClose();
		},
	});

	const basis = draft.basis ?? null;
	// `not_approved` carries no conditions: there is nothing to satisfy.
	const wantsConditions = kind !== "not_approved";
	const selected = conditions.filter((_, index) => checked.has(index));

	function toggle(index: number) {
		setChecked((previous) => {
			const next = new Set(previous);
			if (next.has(index)) next.delete(index);
			else next.add(index);
			return next;
		});
	}

	function addCondition() {
		const trimmed = title.trim();
		if (!trimmed) return;
		setConditions((previous) => {
			const next = [
				...previous,
				{
					id: "",
					title: trimmed,
					detail: detail.trim(),
					action: "",
					priority: "medium",
					source: "custom",
				},
			];
			setChecked((seen) => new Set(seen).add(next.length - 1));
			return next;
		});
		setTitle("");
		setDetail("");
	}

	function submit() {
		if (!basis || !kind) return;
		publish.mutate({
			kind: kind as PublishDecisionRequest["kind"],
			result_id: basis.result_id,
			conditions: wantsConditions ? selected : [],
			message: message.trim() ? message.trim() : null,
		});
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
			{/* A plain div, like `WebcamCaptureModal`: `<dialog>` needs an
			    imperative showModal() this render path does not have. */}
			{/* biome-ignore lint/a11y/useSemanticElements: see above */}
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Update borrower status"
				className="w-full max-w-lg max-h-full overflow-y-auto bg-white rounded-lg border border-slate-200 shadow-lg"
			>
				<header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
					<h2 className="text-base font-semibold text-slate-900">Update borrower status</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center"
					>
						<X size={16} />
					</button>
				</header>

				<div className="px-6 py-4 space-y-5">
					<fieldset className="space-y-2">
						<legend className="text-xs font-medium text-slate-500 uppercase tracking-wider">
							Outcome
						</legend>
						{kinds.map((option) => (
							<label
								key={option.key}
								data-kind={option.key}
								className="flex items-start gap-2 cursor-pointer"
							>
								<input
									type="radio"
									name="decision-kind"
									value={option.key}
									checked={kind === option.key}
									onChange={() => setKind(option.key)}
									className="mt-1"
								/>
								<span className="text-sm text-slate-900">
									{option.label}
									{draft.suggested_kind === option.key ? (
										<span className="block text-xs text-slate-500">
											{/* The annotation names the calculation the engine read,
											    never a product name composed here. */}
											{basis?.manifest_name ? `Suggested from ${basis.manifest_name}` : "Suggested"}
										</span>
									) : null}
								</span>
							</label>
						))}
					</fieldset>

					<section className="space-y-2">
						<h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Terms</h3>
						{basis ? (
							<>
								<dl className="grid grid-cols-2 gap-x-6 gap-y-1">
									{(draft.terms ?? []).map((term) => (
										<div key={term.field} className="flex items-baseline justify-between gap-3">
											<dt className="text-xs text-slate-500">{term.label}</dt>
											<dd className="text-sm font-medium text-slate-900">{term.display}</dd>
										</div>
									))}
								</dl>
								<p className="text-xs text-slate-500">
									Based on: {basis.manifest_name || basis.manifest_id}
								</p>
								<p className="text-xs text-slate-500">
									Terms are read-only — to publish different numbers, run a refinement first and
									reopen this panel.
								</p>
							</>
						) : (
							<p className="text-sm text-amber-700">
								The analysis has not run for this case yet, so there are no terms to publish. Run it
								first.
							</p>
						)}
					</section>

					{wantsConditions ? (
						<section className="space-y-2">
							<h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
								Conditions
							</h3>
							{conditions.map((condition, index) => (
								<label
									key={`${condition.title}-${index}`}
									className="flex items-start gap-2 cursor-pointer"
								>
									<input
										type="checkbox"
										checked={checked.has(index)}
										onChange={() => toggle(index)}
										className="mt-1"
									/>
									<span className="text-sm text-slate-900">
										{condition.title}
										{condition.detail ? (
											<span className="block text-xs text-slate-500">{condition.detail}</span>
										) : null}
									</span>
								</label>
							))}
							<div className="pt-2 space-y-2">
								<input
									type="text"
									value={title}
									onChange={(event) => setTitle(event.target.value)}
									aria-label="Condition title"
									placeholder="Condition title"
									className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
								/>
								<input
									type="text"
									value={detail}
									onChange={(event) => setDetail(event.target.value)}
									aria-label="Condition detail"
									placeholder="Detail (optional)"
									className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
								/>
								<button
									type="button"
									onClick={addCondition}
									className="text-sm font-medium text-blue-700 hover:text-blue-900 cursor-pointer"
								>
									Add condition
								</button>
							</div>
						</section>
					) : null}

					<section className="space-y-2">
						<label
							htmlFor="decision-message"
							className="block text-xs font-medium text-slate-500 uppercase tracking-wider"
						>
							Message to borrower
						</label>
						<textarea
							id="decision-message"
							value={message}
							onChange={(event) => setMessage(event.target.value)}
							rows={3}
							className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
						/>
					</section>

					{publish.isError ? (
						<p className="text-sm text-red-600">
							{publish.error instanceof Error ? publish.error.message : "Failed to publish."}
						</p>
					) : null}
				</div>

				<footer className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
					<button
						type="button"
						onClick={onClose}
						className="text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={submit}
						disabled={!basis || !kind || publish.isPending}
						className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
					>
						{publish.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
						Publish to borrower
					</button>
				</footer>
			</div>
		</div>
	);
}

/** Locale date and time, or nothing rather than an "Invalid Date". */
function formatDateTime(value: string | null | undefined): string {
	if (!value) return "";
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return "";
	return `${parsed.toLocaleDateString()} ${parsed.toLocaleTimeString()}`;
}
