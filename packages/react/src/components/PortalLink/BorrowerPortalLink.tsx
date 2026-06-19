import { useState } from "react";
import {
	useCreatePortalLink,
	buildPortalUrl,
	type PortalRequestItem,
} from "../../hooks/useCreatePortalLink.js";

export interface BorrowerPortalLinkProps {
	caseId: string;
	/** Host-supplied base the borrower portal lives at (e.g. https://app.example.com/portal). */
	portalBaseUrl: string;
	/** Veritas-suggested follow-up / completeness items the operator can check off. */
	followUpItems?: PortalRequestItem[];
	/** Called when the operator dismisses the modal. */
	onClose?: () => void;
	className?: string;
}

/**
 * Operator modal that builds a borrower document request and issues a one-time,
 * expiring portal link for it. The officer checks off veritas-suggested
 * follow-ups, adds custom items, writes a note, and generates the link; the
 * request is what the borrower sees on the portal. Wraps {@link useCreatePortalLink}.
 */
export function BorrowerPortalLink({
	caseId,
	portalBaseUrl,
	followUpItems = [],
	onClose,
	className,
}: BorrowerPortalLinkProps) {
	const mutation = useCreatePortalLink(caseId);
	const [checked, setChecked] = useState<Set<number>>(new Set(followUpItems.map((_, i) => i)));
	const [custom, setCustom] = useState<string[]>([]);
	const [draft, setDraft] = useState("");
	const [message, setMessage] = useState("");
	const [copied, setCopied] = useState(false);

	const link = mutation.data ? buildPortalUrl(portalBaseUrl, mutation.data.token) : null;

	function toggle(i: number) {
		setChecked((prev) => {
			const next = new Set(prev);
			next.has(i) ? next.delete(i) : next.add(i);
			return next;
		});
	}

	function addCustom() {
		const t = draft.trim();
		if (t) {
			setCustom((c) => [...c, t]);
			setDraft("");
		}
	}

	function generate() {
		const items: PortalRequestItem[] = [
			...followUpItems.filter((_, i) => checked.has(i)),
			...custom.map((title) => ({ id: "", title, detail: "", action: "", source: "custom", priority: "medium" })),
		];
		mutation.mutate({ items, message: message.trim() || null });
	}

	async function copy() {
		if (!link) return;
		try {
			await navigator.clipboard.writeText(link);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			setCopied(false);
		}
	}

	return (
		<div className={`bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full${className ? ` ${className}` : ""}`}>
			<div className="flex items-start justify-between mb-1">
				<h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
					<span aria-hidden className="text-indigo-600">🔗</span>
					Request documents from borrower
				</h3>
				{onClose && (
					<button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 text-xl leading-none">
						×
					</button>
				)}
			</div>
			<p className="text-sm text-slate-500 mb-5">
				Pick what to request, add a note, and we'll generate a secure 48-hour link
				the borrower can open with no login.
			</p>

			{!link && (
				<div className="space-y-5">
					{followUpItems.length > 0 && (
						<fieldset className="space-y-2">
							<legend className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
								Suggested follow-ups
							</legend>
							{followUpItems.map((item, i) => (
								<label key={i} className="flex gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
									<input type="checkbox" checked={checked.has(i)} onChange={() => toggle(i)} className="mt-1" />
									<span>
										<span className="block text-sm font-medium text-slate-800">{item.title}</span>
										{item.detail && <span className="block text-xs text-slate-500">{item.detail}</span>}
									</span>
								</label>
							))}
						</fieldset>
					)}

					<div>
						<label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Add your own</label>
						<div className="flex gap-2 mt-1">
							<input
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
								onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
								placeholder="e.g. Last 2 pay stubs"
								className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
							/>
							<button type="button" onClick={addCustom} className="rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-medium px-4">
								Add
							</button>
						</div>
						{custom.length > 0 && (
							<ul className="mt-2 space-y-1">
								{custom.map((c, i) => (
									<li key={i} className="flex items-center justify-between text-sm text-slate-700 bg-slate-50 rounded px-3 py-1.5">
										{c}
										<button type="button" onClick={() => setCustom((cs) => cs.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">×</button>
									</li>
								))}
							</ul>
						)}
					</div>

					<div>
						<label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Message to borrower (optional)</label>
						<textarea
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							rows={2}
							placeholder="Hi! Please upload these so we can move forward."
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
						/>
					</div>

					{mutation.error && <p className="text-sm text-red-600" role="alert">{mutation.error.message}</p>}

					<button
						type="button"
						onClick={generate}
						disabled={mutation.isPending}
						className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-3"
					>
						{mutation.isPending ? "Generating…" : "Generate Portal Link"}
					</button>
				</div>
			)}

			{link && (
				<div className="space-y-3">
					<div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
						Link created. Share it with the borrower.
					</div>
					<div className="flex items-center gap-2">
						<input
							readOnly
							value={link}
							onFocus={(e) => e.currentTarget.select()}
							className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
						/>
						<button type="button" onClick={copy} className="rounded-lg bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium px-4 py-2">
							{copied ? "Copied" : "Copy"}
						</button>
					</div>
					{mutation.data && (
						<p className="text-xs text-slate-400">Expires {new Date(mutation.data.expires_at).toLocaleString()}</p>
					)}
				</div>
			)}
		</div>
	);
}
